<script>
import { debounce, pickBy } from 'lodash';
import { mapActions, mapState, mapGetters } from 'vuex';
import VueDraggable from 'vuedraggable';
import {
  GlButton,
  GlDropdown,
  GlDropdownItem,
  GlDropdownHeader,
  GlDropdownDivider,
  GlFormGroup,
  GlModal,
  GlLoadingIcon,
  GlSearchBoxByType,
  GlModalDirective,
  GlTooltipDirective,
} from '@gitlab/ui';
import PanelType from 'ee_else_ce/monitoring/components/panel_type.vue';
import { s__ } from '~/locale';
import createFlash from '~/flash';
import glFeatureFlagsMixin from '~/vue_shared/mixins/gl_feature_flags_mixin';
import {
  mergeUrlParams,
  redirectTo,
  refreshCurrentPage,
  updateHistory,
} from '~/lib/utils/url_utility';
import invalidUrl from '~/lib/utils/invalid_url';
import Icon from '~/vue_shared/components/icon.vue';
import DateTimePicker from '~/vue_shared/components/date_time_picker/date_time_picker.vue';

import GraphGroup from './graph_group.vue';
import EmptyState from './empty_state.vue';
import GroupEmptyState from './group_empty_state.vue';
import DashboardsDropdown from './dashboards_dropdown.vue';

import TrackEventDirective from '~/vue_shared/directives/track_event';
import { getAddMetricTrackingOptions, timeRangeToUrl, timeRangeFromUrl } from '../utils';
import { metricStates } from '../constants';
import { defaultTimeRange, timeRanges } from '~/vue_shared/constants';

export default {
  components: {
    VueDraggable,
    PanelType,
    Icon,
    GlButton,
    GlDropdown,
    GlLoadingIcon,
    GlDropdownItem,
    GlDropdownHeader,
    GlDropdownDivider,
    GlSearchBoxByType,
    GlFormGroup,
    GlModal,

    DateTimePicker,
    GraphGroup,
    EmptyState,
    GroupEmptyState,
    DashboardsDropdown,
  },
  directives: {
    GlModal: GlModalDirective,
    GlTooltip: GlTooltipDirective,
    TrackEvent: TrackEventDirective,
  },
  mixins: [glFeatureFlagsMixin()],
  props: {
    externalDashboardUrl: {
      type: String,
      required: false,
      default: '',
    },
    hasMetrics: {
      type: Boolean,
      required: false,
      default: true,
    },
    showHeader: {
      type: Boolean,
      required: false,
      default: true,
    },
    showPanels: {
      type: Boolean,
      required: false,
      default: true,
    },
    documentationPath: {
      type: String,
      required: true,
    },
    settingsPath: {
      type: String,
      required: true,
    },
    clustersPath: {
      type: String,
      required: true,
    },
    tagsPath: {
      type: String,
      required: true,
    },
    projectPath: {
      type: String,
      required: true,
    },
    logsPath: {
      type: String,
      required: false,
      default: invalidUrl,
    },
    defaultBranch: {
      type: String,
      required: true,
    },
    metricsEndpoint: {
      type: String,
      required: true,
    },
    deploymentsEndpoint: {
      type: String,
      required: false,
      default: null,
    },
    emptyGettingStartedSvgPath: {
      type: String,
      required: true,
    },
    emptyLoadingSvgPath: {
      type: String,
      required: true,
    },
    emptyNoDataSvgPath: {
      type: String,
      required: true,
    },
    emptyNoDataSmallSvgPath: {
      type: String,
      required: true,
    },
    emptyUnableToConnectSvgPath: {
      type: String,
      required: true,
    },
    currentEnvironmentName: {
      type: String,
      required: true,
    },
    customMetricsAvailable: {
      type: Boolean,
      required: false,
      default: false,
    },
    customMetricsPath: {
      type: String,
      required: false,
      default: invalidUrl,
    },
    validateQueryPath: {
      type: String,
      required: false,
      default: invalidUrl,
    },
    dashboardEndpoint: {
      type: String,
      required: false,
      default: invalidUrl,
    },
    dashboardsEndpoint: {
      type: String,
      required: false,
      default: invalidUrl,
    },
    currentDashboard: {
      type: String,
      required: false,
      default: '',
    },
    smallEmptyState: {
      type: Boolean,
      required: false,
      default: false,
    },
    alertsEndpoint: {
      type: String,
      required: false,
      default: null,
    },
    prometheusAlertsAvailable: {
      type: Boolean,
      required: false,
      default: false,
    },
    rearrangePanelsAvailable: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      state: 'gettingStarted',
      formIsValid: null,
      selectedTimeRange: timeRangeFromUrl() || defaultTimeRange,
      hasValidDates: true,
      timeRanges,
      isRearrangingPanels: false,
    };
  },
  computed: {
    canAddMetrics() {
      return this.customMetricsAvailable && this.customMetricsPath.length;
    },
    ...mapState('monitoringDashboard', [
      'dashboard',
      'emptyState',
      'showEmptyState',
      'deploymentData',
      'useDashboardEndpoint',
      'allDashboards',
      'additionalPanelTypesEnabled',
      'environmentsLoading',
    ]),
    ...mapGetters('monitoringDashboard', ['getMetricStates', 'filteredEnvironments']),
    firstDashboard() {
      return this.allDashboards.length > 0 ? this.allDashboards[0] : {};
    },
    selectedDashboard() {
      return this.allDashboards.find(d => d.path === this.currentDashboard) || this.firstDashboard;
    },
    showRearrangePanelsBtn() {
      return !this.showEmptyState && this.rearrangePanelsAvailable;
    },
    addingMetricsAvailable() {
      return IS_EE && this.canAddMetrics && !this.showEmptyState;
    },
    hasHeaderButtons() {
      return (
        this.addingMetricsAvailable ||
        this.showRearrangePanelsBtn ||
        this.selectedDashboard.can_edit ||
        this.externalDashboardUrl.length
      );
    },
    shouldShowEnvironmentsDropdownNoMatchedMsg() {
      return !this.environmentsLoading && this.filteredEnvironments.length === 0;
    },
  },
  created() {
    this.setEndpoints({
      metricsEndpoint: this.metricsEndpoint,
      deploymentsEndpoint: this.deploymentsEndpoint,
      dashboardEndpoint: this.dashboardEndpoint,
      dashboardsEndpoint: this.dashboardsEndpoint,
      currentDashboard: this.currentDashboard,
      projectPath: this.projectPath,
      logsPath: this.logsPath,
    });
  },
  mounted() {
    if (!this.hasMetrics) {
      this.setGettingStartedEmptyState();
    } else {
      this.setTimeRange(this.selectedTimeRange);
      this.fetchData();
    }
  },
  methods: {
    ...mapActions('monitoringDashboard', [
      'setTimeRange',
      'fetchData',
      'setGettingStartedEmptyState',
      'setEndpoints',
      'setPanelGroupMetrics',
      'filterEnvironments',
    ]),
    updatePanels(key, panels) {
      this.setPanelGroupMetrics({
        panels,
        key,
      });
    },
    removePanel(key, panels, graphIndex) {
      this.setPanelGroupMetrics({
        panels: panels.filter((v, i) => i !== graphIndex),
        key,
      });
    },

    onDateTimePickerInput(timeRange) {
      redirectTo(timeRangeToUrl(timeRange));
    },
    onDateTimePickerInvalid() {
      createFlash(
        s__(
          'Metrics|Link contains an invalid time window, please verify the link to see the requested time range.',
        ),
      );
      // As a fallback, switch to default time range instead
      this.selectedTimeRange = defaultTimeRange;
    },

    generateLink(group, title, yLabel) {
      const dashboard = this.currentDashboard || this.firstDashboard.path;
      const params = pickBy({ dashboard, group, title, y_label: yLabel }, value => value != null);
      return mergeUrlParams(params, window.location.href);
    },
    hideAddMetricModal() {
      this.$refs.addMetricModal.hide();
    },
    toggleRearrangingPanels() {
      this.isRearrangingPanels = !this.isRearrangingPanels;
    },
    setFormValidity(isValid) {
      this.formIsValid = isValid;
    },
    debouncedEnvironmentsSearch: debounce(function environmentsSearchOnInput(searchTerm) {
      this.filterEnvironments(searchTerm);
    }, 500),
    submitCustomMetricsForm() {
      this.$refs.customMetricsForm.submit();
    },
    /**
     * Return a single empty state for a group.
     *
     * If all states are the same a single state is returned to be displayed
     * Except if the state is OK, in which case the group is displayed.
     *
     * @param {String} groupKey - Identifier for group
     * @returns {String} state code from `metricStates`
     */
    groupSingleEmptyState(groupKey) {
      const states = this.getMetricStates(groupKey);
      if (states.length === 1 && states[0] !== metricStates.OK) {
        return states[0];
      }
      return null;
    },
    /**
     * A group should be not collapsed if any metric is loaded (OK)
     *
     * @param {String} groupKey - Identifier for group
     * @returns {Boolean} If the group should be collapsed
     */
    collapseGroup(groupKey) {
      // Collapse group if no data is available
      return !this.getMetricStates(groupKey).includes(metricStates.OK);
    },
    getAddMetricTrackingOptions,

    selectDashboard(dashboard) {
      const params = {
        dashboard: dashboard.path,
      };
      redirectTo(mergeUrlParams(params, window.location.href));
    },

    refreshDashboard() {
      refreshCurrentPage();
    },

    onTimeRangeZoom({ start, end }) {
      updateHistory({
        url: mergeUrlParams({ start, end }, window.location.href),
        title: document.title,
      });
      this.selectedTimeRange = { start, end };
    },
  },
  addMetric: {
    title: s__('Metrics|Add metric'),
    modalId: 'add-metric',
  },
};
</script>

<template>
  <div class="prometheus-graphs" data-qa-selector="prometheus_graphs">
    <div
      v-if="showHeader"
      ref="prometheusGraphsHeader"
      class="prometheus-graphs-header gl-p-3 pb-0 border-bottom bg-gray-light"
    >
      <div class="row">
        <gl-form-group
          :label="__('Dashboard')"
          label-size="sm"
          label-for="monitor-dashboards-dropdown"
          class="col-sm-12 col-md-6 col-lg-2"
        >
          <dashboards-dropdown
            id="monitor-dashboards-dropdown"
            class="mb-0 d-flex"
            toggle-class="dropdown-menu-toggle"
            :default-branch="defaultBranch"
            :selected-dashboard="selectedDashboard"
            @selectDashboard="selectDashboard($event)"
          />
        </gl-form-group>

        <gl-form-group
          :label="s__('Metrics|Environment')"
          label-size="sm"
          label-for="monitor-environments-dropdown"
          class="col-sm-6 col-md-6 col-lg-2"
        >
          <gl-dropdown
            id="monitor-environments-dropdown"
            ref="monitorEnvironmentsDropdown"
            data-qa-selector="environments_dropdown"
            class="mb-0 d-flex"
            toggle-class="dropdown-menu-toggle"
            menu-class="monitor-environment-dropdown-menu"
            :text="currentEnvironmentName"
          >
            <div class="d-flex flex-column overflow-hidden">
              <gl-dropdown-header class="monitor-environment-dropdown-header text-center">{{
                __('Environment')
              }}</gl-dropdown-header>
              <gl-dropdown-divider />
              <gl-search-box-by-type
                ref="monitorEnvironmentsDropdownSearch"
                class="m-2"
                @input="debouncedEnvironmentsSearch"
              />
              <gl-loading-icon
                v-if="environmentsLoading"
                ref="monitorEnvironmentsDropdownLoading"
                :inline="true"
              />
              <div v-else class="flex-fill overflow-auto">
                <gl-dropdown-item
                  v-for="environment in filteredEnvironments"
                  :key="environment.id"
                  :active="environment.name === currentEnvironmentName"
                  active-class="is-active"
                  :href="environment.metrics_path"
                  >{{ environment.name }}</gl-dropdown-item
                >
              </div>
              <div
                v-show="shouldShowEnvironmentsDropdownNoMatchedMsg"
                ref="monitorEnvironmentsDropdownMsg"
                class="text-secondary no-matches-message"
              >
                {{ __('No matching results') }}
              </div>
            </div>
          </gl-dropdown>
        </gl-form-group>

        <gl-form-group
          :label="s__('Metrics|Show last')"
          label-size="sm"
          label-for="monitor-time-window-dropdown"
          class="col-sm-auto col-md-auto col-lg-auto"
        >
          <date-time-picker
            ref="dateTimePicker"
            :value="selectedTimeRange"
            :options="timeRanges"
            @input="onDateTimePickerInput"
            @invalid="onDateTimePickerInvalid"
          />
        </gl-form-group>

        <gl-form-group class="col-sm-2 col-md-2 col-lg-1 refresh-dashboard-button">
          <gl-button
            ref="refreshDashboardBtn"
            v-gl-tooltip
            variant="default"
            :title="s__('Metrics|Reload this page')"
            @click="refreshDashboard"
          >
            <icon name="repeat" />
          </gl-button>
        </gl-form-group>

        <gl-form-group
          v-if="hasHeaderButtons"
          label-for="prometheus-graphs-dropdown-buttons"
          class="dropdown-buttons col-md d-md-flex col-lg d-lg-flex align-items-end"
        >
          <div id="prometheus-graphs-dropdown-buttons">
            <gl-button
              v-if="showRearrangePanelsBtn"
              :pressed="isRearrangingPanels"
              variant="default"
              class="mr-2 mt-1 js-rearrange-button"
              @click="toggleRearrangingPanels"
              >{{ __('Arrange charts') }}</gl-button
            >
            <gl-button
              v-if="addingMetricsAvailable"
              ref="addMetricBtn"
              v-gl-modal="$options.addMetric.modalId"
              variant="outline-success"
              data-qa-selector="add_metric_button"
              class="mr-2 mt-1"
              >{{ $options.addMetric.title }}</gl-button
            >
            <gl-modal
              v-if="addingMetricsAvailable"
              ref="addMetricModal"
              :modal-id="$options.addMetric.modalId"
              :title="$options.addMetric.title"
            >
              <form ref="customMetricsForm" :action="customMetricsPath" method="post">
                <custom-metrics-form-fields
                  :validate-query-path="validateQueryPath"
                  form-operation="post"
                  @formValidation="setFormValidity"
                />
              </form>
              <div slot="modal-footer">
                <gl-button @click="hideAddMetricModal">{{ __('Cancel') }}</gl-button>
                <gl-button
                  ref="submitCustomMetricsFormBtn"
                  v-track-event="getAddMetricTrackingOptions()"
                  :disabled="!formIsValid"
                  variant="success"
                  @click="submitCustomMetricsForm"
                  >{{ __('Save changes') }}</gl-button
                >
              </div>
            </gl-modal>

            <gl-button
              v-if="selectedDashboard.can_edit"
              class="mt-1 js-edit-link"
              :href="selectedDashboard.project_blob_path"
              >{{ __('Edit dashboard') }}</gl-button
            >

            <gl-button
              v-if="externalDashboardUrl.length"
              class="mt-1 js-external-dashboard-link"
              variant="primary"
              :href="externalDashboardUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ __('View full dashboard') }}
              <icon name="external-link" />
            </gl-button>
          </div>
        </gl-form-group>
      </div>
    </div>

    <div v-if="!showEmptyState">
      <graph-group
        v-for="(groupData, index) in dashboard.panelGroups"
        :key="`${groupData.group}.${groupData.priority}`"
        :name="groupData.group"
        :show-panels="showPanels"
        :collapse-group="collapseGroup(groupData.key)"
      >
        <vue-draggable
          v-if="!groupSingleEmptyState(groupData.key)"
          :value="groupData.panels"
          group="metrics-dashboard"
          :component-data="{ attrs: { class: 'row mx-0 w-100' } }"
          :disabled="!isRearrangingPanels"
          @input="updatePanels(groupData.key, $event)"
        >
          <div
            v-for="(graphData, graphIndex) in groupData.panels"
            :key="`panel-type-${graphIndex}`"
            class="col-12 col-lg-6 px-2 mb-2 draggable"
            :class="{ 'draggable-enabled': isRearrangingPanels }"
          >
            <div class="position-relative draggable-panel js-draggable-panel">
              <div
                v-if="isRearrangingPanels"
                class="draggable-remove js-draggable-remove p-2 w-100 position-absolute d-flex justify-content-end"
                @click="removePanel(groupData.key, groupData.panels, graphIndex)"
              >
                <a class="mx-2 p-2 draggable-remove-link" :aria-label="__('Remove')">
                  <icon name="close" />
                </a>
              </div>

              <panel-type
                :clipboard-text="generateLink(groupData.group, graphData.title, graphData.y_label)"
                :graph-data="graphData"
                :alerts-endpoint="alertsEndpoint"
                :prometheus-alerts-available="prometheusAlertsAvailable"
                :index="`${index}-${graphIndex}`"
                @timerangezoom="onTimeRangeZoom"
              />
            </div>
          </div>
        </vue-draggable>
        <div v-else class="py-5 col col-sm-10 col-md-8 col-lg-7 col-xl-6">
          <group-empty-state
            ref="empty-group"
            :documentation-path="documentationPath"
            :settings-path="settingsPath"
            :selected-state="groupSingleEmptyState(groupData.key)"
            :svg-path="emptyNoDataSmallSvgPath"
          />
        </div>
      </graph-group>
    </div>
    <empty-state
      v-else
      :selected-state="emptyState"
      :documentation-path="documentationPath"
      :settings-path="settingsPath"
      :clusters-path="clustersPath"
      :empty-getting-started-svg-path="emptyGettingStartedSvgPath"
      :empty-loading-svg-path="emptyLoadingSvgPath"
      :empty-no-data-svg-path="emptyNoDataSvgPath"
      :empty-no-data-small-svg-path="emptyNoDataSmallSvgPath"
      :empty-unable-to-connect-svg-path="emptyUnableToConnectSvgPath"
      :compact="smallEmptyState"
    />
  </div>
</template>
