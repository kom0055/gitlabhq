# frozen_string_literal: true

module QA
  context 'Create' do
    describe 'Git push over HTTP', :ldap_no_tls do
      it 'user pushes code to the repository' do
        Flow::Login.sign_in

        Resource::Repository::ProjectPush.fabricate! do |push|
          push.file_name = 'README.md'
          push.file_content = '# This is a test project'
          push.commit_message = 'Add README.md'
        end.project.visit!

        Page::Project::Show.perform do |project|
          expect(project).to have_file('README.md')
          expect(project).to have_readme_content('This is a test project')
        end
      end

      it 'pushes to a project using a specific Praefect repository storage', :smoke, :requires_admin, :requires_praefect, quarantine: { issue: 'https://gitlab.com/gitlab-org/quality/testcases/-/issues/276', type: :new } do
        Flow::Login.sign_in_as_admin

        project = Resource::Project.fabricate_via_api! do |storage_project|
          storage_project.name = 'specific-repository-storage'
          storage_project.repository_storage = QA::Runtime::Env.praefect_repository_storage
        end

        Resource::Repository::Push.fabricate! do |push|
          push.repository_http_uri = project.repository_http_location.uri
          push.file_name = 'README.md'
          push.file_content = "# This is a test project named #{project.name}"
          push.commit_message = 'Add README.md'
          push.new_branch = true
        end

        project.visit!

        expect(page).to have_content('README.md')
        expect(page).to have_content("This is a test project named #{project.name}")
      end
    end
  end
end
