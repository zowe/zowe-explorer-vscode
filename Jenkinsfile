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

/**
 * List of people who will get all emails for master builds
 */
def MASTER_RECIPIENTS_LIST = "fernando.rijocedeno@broadcom.com"

/**
 * Name of the master branch
 */
def MASTER_BRANCH = "master"

/**
 * Name of the VSCE publisher
 */
def PUBLISHER_NAME = "Zowe"

/**
 * TOKEN ID where secret is stored
 */
def PUBLISH_TOKEN = "vsce-publish-key"

/**
 * Version to be published
 */
def PUBLISH_VERSION = "0.0.0"

def PIPELINE_CONTROL = [
  ci_skip: false
]

pipeline {
  agent { label 'ca-jenkins-agent' }
  stages {
    stage('Check for CI Skip') { steps {
      timeout(time: 2, unit: 'MINUTES') { script {
        def result = sh returnStatus: true, script: 'git log -1 | grep \'.*\\[ci skip\\].*\''
        if (result == 0) {
          echo '"ci skip" spotted in the git commit. Aborting.'
          PIPELINE_CONTROL.ci_skip = true
        } }
      }
    } }
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
    stage('Build') {
      when { allOf {
        expression { return !PIPELINE_CONTROL.ci_skip }
      } }
      steps {
        timeout(time: 10, unit: 'MINUTES') { script {
          sh "npm run build"
        } }
      }
    }
    stage('Test') {
      when { allOf {
        expression { return !PIPELINE_CONTROL.ci_skip }
      } }
      steps {
        timeout(time: 10, unit: 'MINUTES') { script {
          sh "npm run test"
        } }
      }
    }
    stage('Audit') {
      when { allOf {
        expression { return !PIPELINE_CONTROL.ci_skip }
      } }
      steps {
        timeout(time: 10, unit: 'MINUTES') { script {
          sh "npm audit"
        } }
      }
    }
    stage("Versioning & Changelog") {
      when { allOf {
        expression { return !PIPELINE_CONTROL.ci_skip }
        expression { return BRANCH_NAME == MASTER_BRANCH }
      } }
      steps {
        timeout(time: 10, unit: 'MINUTES') { script {
          def versionInput = input message: "Version information:", submitterParameter: "VERSION", parameters: [
            choice(name: "VERSION", description: "What level should be increased?", choices: ["major", "minor", "patch"])
          ]
          
          echo "User selected: ${versionInput.VERSION}"
          
          def prDescription = sh returnStdout: true, script: "git log --format=%B -n 1"
          echo "${prDescription}"

          sh "npm version ${versionInput.VERSION}"
          sh "git commit --amend --signoff -m \"Bump version to %s [ci skip]\""

          def packageJSON = readJSON file: "package.json"
          PUBLISH_VERSION = packageJSON.version
          
          sh "git reset HEAD --hard"
          
          def changelogFile = "CHANGELOG.md"

          def changelogInput = input message: "Changelog description:", submitterParameter: "TEXT", parameters: [
            text(name: "TEXT", description: "What goes on the changelog?", defaultvalue: '''$prDescription''')
          ]

          def changelogOutput = sh returnStdout: true, script: "sed -n 'H;\${x;s/^\n//;s/## .*\$/## ${PUBLISH_VERSION}\n\n${changelogInput.TEXT}\n\n&/;p;}' ${changelogFile} > ${changelogFile}.temp"
          sh "mv ${changelogFile}.temp ${changelogFile}"

          sh "cat ${changelogFile}"

          sh "git add ${changelogFile}"
          sh "git commit --signoff -m \"Update Changelog for version: ${PUBLISH_VERSION} [ci skip]\""

          sh "git push --dry-run"
        } }
      }
    }
    stage("Publish") {
      when { allOf {
        expression { return !PIPELINE_CONTROL.ci_skip }
        expression { return BRANCH_NAME == MASTER_BRANCH }
      } }
      steps {
        timeout(time: 10, unit: 'MINUTES') { script {
          sh "npx vsce login ${PUBLISHER_NAME}"
          // withCredentials([string(credentialsId: PUBLISH_TOKEN, variable: 'TOKEN')]) {
          //   sh "npx vsce publish ${PUBLISH_VERSION} -p $TOKEN"
          // }
        } }
      }
    }
  }
  post { always { script {
    def buildStatus = currentBuild.currentResult
    def recipients = "${MASTER_RECIPIENTS_LIST}"
    def subjectTitle = "VSCode Extension Deployment"
    def details = "${subjectTitle}"
    if (!PIPELINE_CONTROL.ci_skip) {
      try {
        // get the logs
        try {
          sh("cp -rf /home/jenkins/.npm/_logs deploy-log")
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
