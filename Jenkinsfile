/*
* This program and the accompanying materials are made available under the terms of the
* Eclipse Public License v2.0 which accompanies this distribution, and is available at
* https://www.eclipse.org/legal/epl-v20.html
*
* SPDX-License-Identifier: EPL-2.0
*
* Copyright Contributors to the Zowe Project.
*
*/

@Library('shared-pipelines') import org.zowe.pipelines.nodejs.NodeJSPipeline
def lib = library("jenkins-library").org.zowe.jenkins_shared_library

/**
 * List of people who will get all emails for master builds
 */
def MASTER_RECIPIENTS_LIST = "fernando.rijocedeno@broadcom.com"

/**
 * Name of the master branch
 */
def MASTER_BRANCH = "master"

/**
 * Artifactory URL
 */
def DL_ARTIFACTORY_URL = "https://zowe.jfrog.io/zowe/api/npm/libs-snapshot-local/org/zowe/vscode/"

/**
 * TOKEN ID where secret is stored
 */
def PUBLISH_TOKEN = "vsce-publish-key"

/**
 * TOKEN ID where Artifactory secret is stored
 */
def ARTIFACTORY_CREDENTIALS_ID = "zowe.jfrog.io"

/**
 * TOKEN ID where secret is stored
 */
def ZOWE_ROBOT_TOKEN = "zowe-robot-github"

def PIPELINE_CONTROL = [
  ci_skip: false,
  create_release: false
]

/**
 * Options for the pipeline
 */
def opts = []
opts.push(buildDiscarder(logRotator(numToKeepStr: '10')))
if (BRANCH_NAME == MASTER_BRANCH) opts.push(disableConcurrentBuilds())
opts.push( parameters([
  booleanParam(name: 'SKIP_CI_SKIP', defaultValue: false, description: 'Skip: CI SKIP'),
  booleanParam(name: 'SKIP_TEST', defaultValue: false, description: 'Skip: TEST'),
  booleanParam(name: 'SKIP_AUDIT', defaultValue: false, description: 'Skip: AUDIT'),
  booleanParam(name: 'SKIP_PUBLISH', defaultValue: false, description: 'Skip: PUBLISH'),
  string(name: 'RECIPIENTS_LIST', defaultValue: '', description: 'List of emails to receive build results (Override)')
]) )
properties(opts)

pipeline {
  agent { label 'ca-jenkins-agent' }
  stages {
    stage('Check for CI Skip') {
      when { allOf {
        expression { return !params.SKIP_CI_SKIP }
      } }
      steps {
        timeout(time: 2, unit: 'MINUTES') { script {
          def result = sh returnStatus: true, script: 'git log -1 | grep \'.*\\[ci skip\\].*\''
          if (result == 0) {
            echo '"ci skip" spotted in the git commit. Aborting.'
            PIPELINE_CONTROL.ci_skip = true
          }
        } }
      }
    }
    stage('Install dependencies') {
      when { allOf {
        expression { return !PIPELINE_CONTROL.ci_skip }
      } }
      steps {
        timeout(time: 10, unit: 'MINUTES') { script {
          sh "npm install"
        } }
      }
    }
    stage('Lint') {
      when { allOf {
        expression { return !PIPELINE_CONTROL.ci_skip }
      } }
      steps {
        timeout(time: 10, unit: 'MINUTES') { script {
          sh "npm run lint"
        } }
      }
    }
    stage('Build') {
      when { allOf {
        expression { return !PIPELINE_CONTROL.ci_skip }
      } }
      steps {
        timeout(time: 10, unit: 'MINUTES') { script {
          // copy test properties file
          sh "cp resources/testProfileData.example.ts resources/testProfileData.ts"
          sh "npm run build"
        } }
      }
    }
    stage('Test') {
      when { allOf {
        expression { return !PIPELINE_CONTROL.ci_skip }
        expression { return !params.SKIP_TEST }
      } }
      steps {
        timeout(time: 10, unit: 'MINUTES') { script {
          sh "npm run test"
        } }
      }
    }
    stage('Artifactory') {
      when { allOf {
        expression { return !PIPELINE_CONTROL.ci_skip }
        expression { return !params.SKIP_TEST }
      } }
      steps {
        timeout(time: 10, unit: 'MINUTES') { script {
                    withCredentials([usernamePassword(credentialsId: ARTIFACTORY_CREDENTIALS_ID, usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                        //sh "rm -f .npmrc"
                        //sh "rm -f ~/.npmrc"

                        // Set the SCOPED registry and token to the npmrc of the user
                        sh "npm config set ${TARGET_SCOPE}:registry ${DL_ARTIFACTORY_URL}"
                        sh "expect -f ./jenkins/npm_login.expect $USERNAME $PASSWORD \"$ARTIFACTORY_EMAIL\" ${DL_URL.artifactory} ${TARGET_SCOPE}"

                        script {
                            if (BRANCH_NAME == DEV_BRANCH.master) {
                                sh "npm publish --dry-run --tag daily"
                            }
                            else {
                                sh "npm publish --dry-run --tag ${BRANCH_NAME}"
                            }
                        }
                        sh "npm logout --registry=${DL_URL.artifactory} --scope=${TARGET_SCOPE}"
                        //sh "rm -f ~/.npmrc"
                    }

            // withCredentials([usernamePassword(credentialsId: ARTIFACTORY_CREDENTIALS_ID, usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
            //   sh "npm config set @zowe:registry https://gizaartifactory.jfrog.io:8081/gizaartifactory/api/npm/npm-release"
            //   sh "curl -uadmin:$PASSWORD https://gizaartifactory.jfrog.io:8081/artifactory/api/npm/npm-repo/auth/@zowe"
            //   sh "npm publish --dry-run @zowe:registry https://gizaartifactory.jfrog.io/gizaartifactory/api/npm/npm-release/"
            // }
        } }
      }
    }
    stage('Codecov') {
      when { allOf {
        expression { return !PIPELINE_CONTROL.ci_skip }
        expression { return !params.SKIP_TEST }
      } }
      steps {
        timeout(time: 10, unit: 'MINUTES') { script {
          withCredentials([usernamePassword(credentialsId: 'CODECOV_ZOWE_VSCODE', usernameVariable: 'CODECOV_USERNAME', passwordVariable: 'CODECOV_TOKEN')]) {
              sh "curl -s https://codecov.io/bash | bash -s"
          }
        } }
      }
    }
    stage('Audit') {
      when { allOf {
        expression { return !PIPELINE_CONTROL.ci_skip }
        expression { return !params.SKIP_AUDIT }
      } }
      steps {
        timeout(time: 10, unit: 'MINUTES') { script {
          sh "npm audit"
        } }
      }
    }
    stage('Publish') {
      when { allOf {
        expression { return !PIPELINE_CONTROL.ci_skip }
        expression { return BRANCH_NAME == MASTER_BRANCH }
        expression { return !params.SKIP_PUBLISH }
      } }
      steps {
        timeout(time: 10, unit: 'MINUTES') { script {
          def vscodePackageJson = readJSON file: "package.json"
          def extensionMetadata = sh(returnStdout: true, script: "npx vsce show ${vscodePackageJson.publisher}.${vscodePackageJson.name} --json").trim()
          def extensionInfo = readJSON text: extensionMetadata

          if (extensionInfo.versions[0].version == vscodePackageJson.version) {
            PIPELINE_CONTROL.create_release = false
            echo "No new version to publish at this time (${vscodePackageJson.version})"
          } else {
            PIPELINE_CONTROL.create_release = true
            echo "Publishing version ${vscodePackageJson.version} since it's different from ${extensionInfo.versions[0].version}"
            withCredentials([string(credentialsId: PUBLISH_TOKEN, variable: 'TOKEN')]) {
              sh "npx vsce publish -p $TOKEN"
            }
          }
        } }
      }
    }
    stage('Release') {
      when { allOf {
        expression { return !PIPELINE_CONTROL.ci_skip }
        expression { return BRANCH_NAME == MASTER_BRANCH }
        expression { return !params.SKIP_PUBLISH }
        expression { return PIPELINE_CONTROL.create_release }
      } }
      steps {
        timeout(time: 10, unit: 'MINUTES') { script {
          sh "git config --global user.name \"zowe-robot\""
          sh "git config --global user.email \"zowe.robot@gmail.com\""

          def vscodePackageJson = readJSON file: "package.json"
          def version = "v${vscodePackageJson.version}"
          sh "git tag ${version}"

          sh "npx vsce package -o ${version}.vsix"

          withCredentials([usernamePassword(credentialsId: ZOWE_ROBOT_TOKEN, usernameVariable: 'USERNAME', passwordVariable: 'TOKEN')]) { script {
            sh "git push --tags https://$TOKEN:x-oauth-basic@github.com/zowe/vscode-extension-for-zowe.git"

            def releaseAPI = "repos/zowe/vscode-extension-for-zowe/releases"
            def releaseDetails = "{\"tag_name\":\"$version\",\"target_commitish\":\"master\",\"name\":\"$version\",\"draft\":true,\"prerelease\":false}"
            def releaseUrl = "https://$TOKEN:x-oauth-basic@api.github.com/${releaseAPI}"

            def releaseCreated = sh(returnStdout: true, script: "curl -H \"Content-Type: application/json\" -X POST -d '${releaseDetails}' ${releaseUrl}").trim()
            def releaseParsed = readJSON text: releaseCreated

            def uploadUrl = "https://$TOKEN:x-oauth-basic@uploads.github.com/${releaseAPI}/${releaseParsed.id}/assets?name=${version}.vsix"

            sh "curl -X POST --data-binary @${version}.vsix -H \"Content-Type: application/octet-stream\" ${uploadUrl}"
                    withCredentials([usernamePassword(credentialsId: ARTIFACTORY_CREDENTIALS_ID, usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                      echo "Removing .npmrc"
                        sh "rm -f .npmrc"
                        echo "Removing ~/.npmrc"
                        sh "rm -f ~/.npmrc"

                        // Set the SCOPED registry and token to the npmrc of the user
                        echo "Set the SCOPED registry and token to the npmrc of the user (${TARGET_SCOPE}:registry ${DL_ARTIFACTORY_URL})"
                        sh "npm config set ${TARGET_SCOPE}:registry ${DL_ARTIFACTORY_URL}"
                        echo "username: $USERNAME password: $PASSWORD email: $ARTIFACTORY_EMAIL"
                        sh "expect -f ./jenkins/npm_login.expect $USERNAME $PASSWORD \"$ARTIFACTORY_EMAIL\" ${DL_URL.artifactory} ${TARGET_SCOPE}"

                        script {
                            if (BRANCH_NAME == DEV_BRANCH.master) {
                              echo "npm publish --dry-run --tag daily"
                                sh "npm publish --dry-run --tag daily"
                            }
                            else {
                              echo "npm publish --dry-run --tag ${BRANCH_NAME}"
                                sh "npm publish --dry-run --tag ${BRANCH_NAME}"
                            }
                        }
                        echo "npm logout --registry=${DL_URL.artifactory} --scope=${TARGET_SCOPE}"
                        sh "npm logout --registry=${DL_URL.artifactory} --scope=${TARGET_SCOPE}"
                        echo "Removing ~/.npmrc"
                        sh "rm -f ~/.npmrc"
                    }

            // withCredentials([usernamePassword(credentialsId: ARTIFACTORY_CREDENTIALS_ID, usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
            //   sh "npm config set @zowe:registry https://gizaartifactory.jfrog.io:8081/gizaartifactory/api/npm/npm-release"
            //   sh "curl -uadmin:$PASSWORD https://gizaartifactory.jfrog.io:8081/artifactory/api/npm/npm-repo/auth/@zowe"
            //   sh "npm publish --dry-run @zowe:registry https://gizaartifactory.jfrog.io/gizaartifactory/api/npm/npm-release/"
            // }
          } }
        } }
      }
    }
  }
  post { always { script {
    def buildStatus = currentBuild.currentResult
    def recipients = params.RECIPIENTS_LIST != '' ? params.RECIPIENTS_LIST : "${MASTER_RECIPIENTS_LIST}"
    def subjectTitle = "VSCode Extension Deployment"
    def details = "${subjectTitle}"
    if (!PIPELINE_CONTROL.ci_skip) {
      try {
        try {
          //sh("cp -rf /home/jenkins/.npm/_logs deploy-log")
        } catch(e) {}
        archiveArtifacts allowEmptyArchive: true, artifacts: 'deploy-log/*.log'

        if (PIPELINE_CONTROL.ci_skip) {
          currentBuild.result = "SUCCESS"
        } else {
          if (buildStatus.equals("SUCCESS")) {
            details = "${details} succeded."
          } else {
            details = "${details} failed.\n\nPlease investigate build ${currentBuild.number}"
          }
          details = "${details}\n\nBuild result: ${currentBuild.absoluteUrl}"
          emailext(to: recipients, subject: "[${buildStatus}] ${subjectTitle}", body: details)
        }
      } catch (e) {
        echo "Experienced an error sending an email for a ${buildStatus} build"
        currentBuild.result = buildStatus
        echo "${details}"
      }
    }
  } } }
}
