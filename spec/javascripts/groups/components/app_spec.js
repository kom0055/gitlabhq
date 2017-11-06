import Vue from 'vue';

import appComponent from '~/groups/components/app.vue';
import groupFolderComponent from '~/groups/components/group_folder.vue';
import groupItemComponent from '~/groups/components/group_item.vue';

import eventHub from '~/groups/event_hub';
import GroupsStore from '~/groups/store/groups_store';
import GroupsService from '~/groups/service/groups_service';

import {
  mockEndpoint, mockGroups, mockSearchedGroups,
  mockRawPageInfo, mockParentGroupItem, mockRawChildren,
  mockChildren, mockPageInfo,
} from '../mock_data';

const createComponent = (hideProjects = false) => {
  const Component = Vue.extend(appComponent);
  const store = new GroupsStore(false);
  const service = new GroupsService(mockEndpoint);

  return new Component({
    propsData: {
      store,
      service,
      hideProjects,
    },
  });
};

const returnServicePromise = (data, failed) => new Promise((resolve, reject) => {
  if (failed) {
    reject(data);
  } else {
    resolve({
      json() {
        return data;
      },
    });
  }
});

describe('AppComponent', () => {
  let vm;

  beforeEach((done) => {
    Vue.component('group-folder', groupFolderComponent);
    Vue.component('group-item', groupItemComponent);

    vm = createComponent();

    Vue.nextTick(() => {
      done();
    });
  });

  describe('computed', () => {
    beforeEach(() => {
      vm.$mount();
    });

    afterEach(() => {
      vm.$destroy();
    });

    describe('groups', () => {
      it('should return list of groups from store', () => {
        spyOn(vm.store, 'getGroups');

        const groups = vm.groups;
        expect(vm.store.getGroups).toHaveBeenCalled();
        expect(groups).not.toBeDefined();
      });
    });

    describe('pageInfo', () => {
      it('should return pagination info from store', () => {
        spyOn(vm.store, 'getPaginationInfo');

        const pageInfo = vm.pageInfo;
        expect(vm.store.getPaginationInfo).toHaveBeenCalled();
        expect(pageInfo).not.toBeDefined();
      });
    });
  });

  describe('methods', () => {
    beforeEach(() => {
      vm.$mount();
    });

    afterEach(() => {
      vm.$destroy();
    });

    describe('fetchGroups', () => {
      it('should call `getGroups` with all the params provided', (done) => {
        spyOn(vm.service, 'getGroups').and.returnValue(returnServicePromise(mockGroups));

        vm.fetchGroups({
          parentId: 1,
          page: 2,
          filterGroupsBy: 'git',
          sortBy: 'created_desc',
          archived: true,
        });
        setTimeout(() => {
          expect(vm.service.getGroups).toHaveBeenCalledWith(1, 2, 'git', 'created_desc', true);
          done();
        }, 0);
      });

      it('should set headers to store for building pagination info when called with `updatePagination`', (done) => {
        spyOn(vm.service, 'getGroups').and.returnValue(returnServicePromise({ headers: mockRawPageInfo }));
        spyOn(vm, 'updatePagination');

        vm.fetchGroups({ updatePagination: true });
        setTimeout(() => {
          expect(vm.service.getGroups).toHaveBeenCalled();
          expect(vm.updatePagination).toHaveBeenCalled();
          done();
        }, 0);
      });

      it('should show flash error when request fails', (done) => {
        spyOn(vm.service, 'getGroups').and.returnValue(returnServicePromise(null, true));
        spyOn($, 'scrollTo');
        spyOn(window, 'Flash');

        vm.fetchGroups({});
        setTimeout(() => {
          expect(vm.isLoading).toBeFalsy();
          expect($.scrollTo).toHaveBeenCalledWith(0);
          expect(window.Flash).toHaveBeenCalledWith('An error occurred. Please try again.');
          done();
        }, 0);
      });
    });

    describe('fetchAllGroups', () => {
      it('should fetch default set of groups', (done) => {
        spyOn(vm, 'fetchGroups').and.returnValue(returnServicePromise(mockGroups));
        spyOn(vm, 'updatePagination').and.callThrough();
        spyOn(vm, 'updateGroups').and.callThrough();

        vm.fetchAllGroups();
        expect(vm.isLoading).toBeTruthy();
        expect(vm.fetchGroups).toHaveBeenCalled();
        setTimeout(() => {
          expect(vm.isLoading).toBeFalsy();
          expect(vm.updateGroups).toHaveBeenCalled();
          done();
        }, 0);
      });

      it('should fetch matching set of groups when app is loaded with search query', (done) => {
        spyOn(vm, 'fetchGroups').and.returnValue(returnServicePromise(mockSearchedGroups));
        spyOn(vm, 'updateGroups').and.callThrough();

        vm.fetchAllGroups();
        expect(vm.fetchGroups).toHaveBeenCalledWith({
          page: null,
          filterGroupsBy: null,
          sortBy: null,
          updatePagination: true,
          archived: null,
        });
        setTimeout(() => {
          expect(vm.updateGroups).toHaveBeenCalled();
          done();
        }, 0);
      });
    });

    describe('fetchPage', () => {
      it('should fetch groups for provided page details and update window state', (done) => {
        spyOn(vm, 'fetchGroups').and.returnValue(returnServicePromise(mockGroups));
        spyOn(vm, 'updateGroups').and.callThrough();
        spyOn(gl.utils, 'mergeUrlParams').and.callThrough();
        spyOn(window.history, 'replaceState');
        spyOn($, 'scrollTo');

        vm.fetchPage(2, null, null, true);
        expect(vm.isLoading).toBeTruthy();
        expect(vm.fetchGroups).toHaveBeenCalledWith({
          page: 2,
          filterGroupsBy: null,
          sortBy: null,
          updatePagination: true,
          archived: true,
        });
        setTimeout(() => {
          expect(vm.isLoading).toBeFalsy();
          expect($.scrollTo).toHaveBeenCalledWith(0);
          expect(gl.utils.mergeUrlParams).toHaveBeenCalledWith({ page: 2 }, jasmine.any(String));
          expect(window.history.replaceState).toHaveBeenCalledWith({
            page: jasmine.any(String),
          }, jasmine.any(String), jasmine.any(String));
          expect(vm.updateGroups).toHaveBeenCalled();
          done();
        }, 0);
      });
    });

    describe('toggleChildren', () => {
      let groupItem;

      beforeEach(() => {
        groupItem = Object.assign({}, mockParentGroupItem);
        groupItem.isOpen = false;
        groupItem.isChildrenLoading = false;
      });

      it('should fetch children of given group and expand it if group is collapsed and children are not loaded', (done) => {
        spyOn(vm, 'fetchGroups').and.returnValue(returnServicePromise(mockRawChildren));
        spyOn(vm.store, 'setGroupChildren');

        vm.toggleChildren(groupItem);
        expect(groupItem.isChildrenLoading).toBeTruthy();
        expect(vm.fetchGroups).toHaveBeenCalledWith({
          parentId: groupItem.id,
        });
        setTimeout(() => {
          expect(vm.store.setGroupChildren).toHaveBeenCalled();
          done();
        }, 0);
      });

      it('should skip network request while expanding group if children are already loaded', () => {
        spyOn(vm, 'fetchGroups');
        groupItem.children = mockRawChildren;

        vm.toggleChildren(groupItem);
        expect(vm.fetchGroups).not.toHaveBeenCalled();
        expect(groupItem.isOpen).toBeTruthy();
      });

      it('should collapse group if it is already expanded', () => {
        spyOn(vm, 'fetchGroups');
        groupItem.isOpen = true;

        vm.toggleChildren(groupItem);
        expect(vm.fetchGroups).not.toHaveBeenCalled();
        expect(groupItem.isOpen).toBeFalsy();
      });

      it('should set `isChildrenLoading` back to `false` if load request fails', (done) => {
        spyOn(vm, 'fetchGroups').and.returnValue(returnServicePromise({}, true));

        vm.toggleChildren(groupItem);
        expect(groupItem.isChildrenLoading).toBeTruthy();
        setTimeout(() => {
          expect(groupItem.isChildrenLoading).toBeFalsy();
          done();
        }, 0);
      });
    });

    describe('leaveGroup', () => {
      let groupItem;
      let childGroupItem;

      beforeEach(() => {
        groupItem = Object.assign({}, mockParentGroupItem);
        groupItem.children = mockChildren;
        childGroupItem = groupItem.children[0];
        groupItem.isChildrenLoading = false;
      });

      it('should leave group and remove group item from tree', (done) => {
        const notice = `You left the "${childGroupItem.fullName}" group.`;
        spyOn(vm.service, 'leaveGroup').and.returnValue(returnServicePromise({ notice }));
        spyOn(vm.store, 'removeGroup').and.callThrough();
        spyOn(window, 'Flash');
        spyOn($, 'scrollTo');

        vm.leaveGroup(childGroupItem, groupItem);
        expect(childGroupItem.isBeingRemoved).toBeTruthy();
        expect(vm.service.leaveGroup).toHaveBeenCalledWith(childGroupItem.leavePath);
        setTimeout(() => {
          expect($.scrollTo).toHaveBeenCalledWith(0);
          expect(vm.store.removeGroup).toHaveBeenCalledWith(childGroupItem, groupItem);
          expect(window.Flash).toHaveBeenCalledWith(notice, 'notice');
          done();
        }, 0);
      });

      it('should show error flash message if request failed to leave group', (done) => {
        const message = 'An error occurred. Please try again.';
        spyOn(vm.service, 'leaveGroup').and.returnValue(returnServicePromise({ status: 500 }, true));
        spyOn(vm.store, 'removeGroup').and.callThrough();
        spyOn(window, 'Flash');

        vm.leaveGroup(childGroupItem, groupItem);
        expect(childGroupItem.isBeingRemoved).toBeTruthy();
        expect(vm.service.leaveGroup).toHaveBeenCalledWith(childGroupItem.leavePath);
        setTimeout(() => {
          expect(vm.store.removeGroup).not.toHaveBeenCalled();
          expect(window.Flash).toHaveBeenCalledWith(message);
          expect(childGroupItem.isBeingRemoved).toBeFalsy();
          done();
        }, 0);
      });

      it('should show appropriate error flash message if request forbids to leave group', (done) => {
        const message = 'Failed to leave the group. Please make sure you are not the only owner.';
        spyOn(vm.service, 'leaveGroup').and.returnValue(returnServicePromise({ status: 403 }, true));
        spyOn(vm.store, 'removeGroup').and.callThrough();
        spyOn(window, 'Flash');

        vm.leaveGroup(childGroupItem, groupItem);
        expect(childGroupItem.isBeingRemoved).toBeTruthy();
        expect(vm.service.leaveGroup).toHaveBeenCalledWith(childGroupItem.leavePath);
        setTimeout(() => {
          expect(vm.store.removeGroup).not.toHaveBeenCalled();
          expect(window.Flash).toHaveBeenCalledWith(message);
          expect(childGroupItem.isBeingRemoved).toBeFalsy();
          done();
        }, 0);
      });
    });

    describe('updatePagination', () => {
      it('should set pagination info to store from provided headers', () => {
        spyOn(vm.store, 'setPaginationInfo');

        vm.updatePagination(mockRawPageInfo);
        expect(vm.store.setPaginationInfo).toHaveBeenCalledWith(mockRawPageInfo);
      });
    });

    describe('updateGroups', () => {
      it('should call setGroups on store if method was called directly', () => {
        spyOn(vm.store, 'setGroups');

        vm.updateGroups(mockGroups);
        expect(vm.store.setGroups).toHaveBeenCalledWith(mockGroups);
      });

      it('should call setSearchedGroups on store if method was called with fromSearch param', () => {
        spyOn(vm.store, 'setSearchedGroups');

        vm.updateGroups(mockGroups, true);
        expect(vm.store.setSearchedGroups).toHaveBeenCalledWith(mockGroups);
      });

      it('should set `isSearchEmpty` prop based on groups count', () => {
        vm.updateGroups(mockGroups);
        expect(vm.isSearchEmpty).toBeFalsy();

        vm.updateGroups([]);
        expect(vm.isSearchEmpty).toBeTruthy();
      });
    });
  });

  describe('created', () => {
    it('should bind event listeners on eventHub', (done) => {
      spyOn(eventHub, '$on');

      const newVm = createComponent();
      newVm.$mount();

      Vue.nextTick(() => {
        expect(eventHub.$on).toHaveBeenCalledWith('fetchPage', jasmine.any(Function));
        expect(eventHub.$on).toHaveBeenCalledWith('toggleChildren', jasmine.any(Function));
        expect(eventHub.$on).toHaveBeenCalledWith('leaveGroup', jasmine.any(Function));
        expect(eventHub.$on).toHaveBeenCalledWith('updatePagination', jasmine.any(Function));
        expect(eventHub.$on).toHaveBeenCalledWith('updateGroups', jasmine.any(Function));
        newVm.$destroy();
        done();
      });
    });

    it('should initialize `searchEmptyMessage` prop with correct string when `hideProjects` is `false`', (done) => {
      const newVm = createComponent();
      newVm.$mount();
      Vue.nextTick(() => {
        expect(newVm.searchEmptyMessage).toBe('Sorry, no groups or projects matched your search');
        newVm.$destroy();
        done();
      });
    });

    it('should initialize `searchEmptyMessage` prop with correct string when `hideProjects` is `true`', (done) => {
      const newVm = createComponent(true);
      newVm.$mount();
      Vue.nextTick(() => {
        expect(newVm.searchEmptyMessage).toBe('Sorry, no groups matched your search');
        newVm.$destroy();
        done();
      });
    });
  });

  describe('beforeDestroy', () => {
    it('should unbind event listeners on eventHub', (done) => {
      spyOn(eventHub, '$off');

      const newVm = createComponent();
      newVm.$mount();
      newVm.$destroy();

      Vue.nextTick(() => {
        expect(eventHub.$off).toHaveBeenCalledWith('fetchPage', jasmine.any(Function));
        expect(eventHub.$off).toHaveBeenCalledWith('toggleChildren', jasmine.any(Function));
        expect(eventHub.$off).toHaveBeenCalledWith('leaveGroup', jasmine.any(Function));
        expect(eventHub.$off).toHaveBeenCalledWith('updatePagination', jasmine.any(Function));
        expect(eventHub.$off).toHaveBeenCalledWith('updateGroups', jasmine.any(Function));
        done();
      });
    });
  });

  describe('template', () => {
    beforeEach(() => {
      vm.$mount();
    });

    afterEach(() => {
      vm.$destroy();
    });

    it('should render loading icon', (done) => {
      vm.isLoading = true;
      Vue.nextTick(() => {
        expect(vm.$el.querySelector('.loading-animation')).toBeDefined();
        expect(vm.$el.querySelector('i.fa').getAttribute('aria-label')).toBe('Loading groups');
        done();
      });
    });

    it('should render groups tree', (done) => {
      vm.store.state.groups = [mockParentGroupItem];
      vm.isLoading = false;
      vm.store.state.pageInfo = mockPageInfo;
      Vue.nextTick(() => {
        expect(vm.$el.querySelector('.groups-list-tree-container')).toBeDefined();
        done();
      });
    });
  });
});
