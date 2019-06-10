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

import org.jenkinsci.plugins.pipeline.modeldefinition.Utils

/**
 * List of people who will get all emails for master builds
 */
def MASTER_RECIPIENTS_LIST = "fernando.rijocedeno@broadcom.com"

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

/**
 * Control constants
 */
def _skipAll = false
def _CI_SKIP = "[ci skip]"

node('ca-jenkins-agent') {
  try {
    checkout scm
    stage("Check CI Skip") {
      def result = steps.sh returnStatus: true, script: 'git log -1 | grep \'.*\\[ci skip\\].*\''
      if (result == 0) {
          steps.echo "\"${_CI_SKIP}\" spotted in the git commit. Aborting."
          _skipAll = true
      }
    }
    stage("Install dependencies") {
      if(_skipAll) Utils.markStageSkippedForConditional(STAGE_NAME)
      sh "npm istall"
    }
    stage("Build") {
      if(_skipAll) Utils.markStageSkippedForConditional(STAGE_NAME)
      sh "npm run build"
    }
    stage("Test") {
      if(_skipAll) Utils.markStageSkippedForConditional(STAGE_NAME)
      sh "npm run test"
    }
    stage("Audit") {
      if(_skipAll) Utils.markStageSkippedForConditional(STAGE_NAME)
      sh "npm audit"
    }
    stage("Versioning & Changelog") {
      if(_skipAll) Utils.markStageSkippedForConditional(STAGE_NAME)
      if (BRANCH_NAME != "master") Utils.markStageSkippedForConditional(STAGE_NAME)
      def versionInput = input message: "Version information:", submitterParameter: "VERSION", parameters: [
        choice(name: "VERSION", description: "What level should be increased?", choices: ["major", "minor", "patch"])
      ]
      
      echo "User selected: ${versionInput.VERSION}"
      
      def prDescription = sh returnStdout: true, script: "git log --format=%B -n 1"
      echo "${prDescription}"

      sh "npm version ${versionInput.VERSION}"
      sh "git commit --amend --signoff -m \"Bump version to %s ${_CI_SKIP}\""

      def packageJSON = readJSON file: "package.json"
      PUBLISH_VERSION = packageJSON.version
      
      sh "git reset HEAD --hard"
      
      def changelogFile = "CHANGELOG.md"

      def changelogInput = input message: "Changelog description:", submitterParameter: "TEXT", parameters: [
        text(name: "TEXT", description: "What goes on the changelog?", defaultvalue: '''$prDescription''')
      ]

      def changelogOutput = sh returnStdout: true, script: "sed -n 'H;\${x;s/^\n//;s/## .*\$/## ${PUBLISH_VERSION}\n\n${changelogInput.TEXT}\n\n&/;p;}' ${changelogFile} > ${changelogFile}.temp"
      sh "mv $${changelogFile}.temp ${changelogFile}"

      sh "cat ${changelogFile}"

      sh "git add ${changelogFile}"
      sh "git commit --signoff -m \"Update Changelog for version: ${PUBLISH_VERSION} ${_CI_SKIP}\""

      sh "git push --dry-run"
    }

    stage("Publish") {
      if(_skipAll) Utils.markStageSkippedForConditional(STAGE_NAME)
      if (BRANCH_NAME != "master") Utils.markStageSkippedForConditional(STAGE_NAME)
      sh "npx vsce login ${PUBLISHER_NAME}"
      // withCredentials([string(credentialsId: PUBLISH_TOKEN, variable: 'TOKEN')]) {
      //   sh "npx vsce publish ${PUBLISH_VERSION} -p $TOKEN"
      // }
    }
  } catch (e) {
    currentBuild.result = "FAILURE"
    error "${e.getMessage()}"
  } finally {
    def buildStatus = currentBuild.currentResult
    def recipients = "${MASTER_RECIPIENTS_LIST}"
    def subjectTitle = "VSCode Extension Deployment"
    def details = "${subjectTitle}"
    try {
      if (buildStatus.equals("SUCCESS")) {
        details = "${details} succeded."
      } else {
        details = "${details} failed.\n\nPlease investigate build ${currentBuild.number}"
      }
      details = "${details}\n\nBuild result: ${currentBuild.absoluteUrl}"
      emailext(to: recipients, subject: "[${buildStatus}] ${subjectTitle}", body: details)
    } catch (e) {
      echo "Experienced an error sending an email for a ${buildStatus} build"
      currentBuild.result = buildStatus
      echo "${details}"
    }
  }
}
