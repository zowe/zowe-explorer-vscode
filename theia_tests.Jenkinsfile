/*
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 */

node('ibm-jenkins-slave-nvm') {
  def lib = library("jenkins-library").org.zowe.jenkins_shared_library

  def pipeline = lib.pipelines.nodejs.NodeJSPipeline.new(this)

  def tests = [:]
  def stageTests1 = []
  def stageTests2 = []

  // Artifactory Details
  def ARTIFACTORY_CREDENTIALS_ID = "zowe.jfrog.io"
  def ARTIFACTORY_UPLOAD_URL = "https://zowe.jfrog.io/zowe/libs-snapshot-local/org/zowe/vscode/"

  pipeline.admins.add("jackjia")

  pipeline.setup(
    packageName: 'ze-regression-test',
    nodeJsVersion: 'v10.18.1',
    // FIXME: this line should be removed after fix the audit error
    ignoreAuditFailure: true
  )

  // build stage is required
  pipeline.build(
    operation: {
      sh "mkdir -p /tmp/theia"
      dir ("/tmp/theia") {
        pipeline.nvmShell "git clone https://github.com/eclipse-theia/theia"
        dir ("theia") {
          pipeline.nvmShell "node -v"
          sh "pwd"
          pipeline.nvmShell "npm cache clean --force"
          pipeline.nvmShell "yarn cache clean"
          pipeline.nvmShell "yarn"
        }
      }
    },
    timeout: [
        time: 20,
        unit: 'MINUTES'
    ]
  )

  pipeline.createStage(
    name: "Build vsix as plugin",
    stage: {
      //Run build
      sh "cp resources/testProfileData.example.ts resources/testProfileData.ts"
      pipeline.nvmShell "npm run build"
      
      // Gather details for build archives
      def vscodePackageJson = readJSON file: "package.json"
      def date = new Date()
      String buildDate = date.format("yyyyMMddHHmmss")
      def fileName = "vscode-extension-for-zowe-v${vscodePackageJson.version}-${BRANCH_NAME}-${buildDate}"

      // Generate a vsix for archiving purposes
      pipeline.nvmShell "npx vsce package -o ${fileName}.vsix"

      dir ("/tmp/theia/theia") {
        sh "mkdir -p plugins"
      }
      // Copy vsix to Theia plugins folder
      sh "cp ${fileName}.vsix '/tmp/theia/theia/plugins/${fileName}.vsix'"

      // Upload vsix to Artifactory
      withCredentials([usernamePassword(credentialsId: ARTIFACTORY_CREDENTIALS_ID, usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
        def uploadUrlArtifactory = "${ARTIFACTORY_UPLOAD_URL}/${fileName}.vsix"
        sh "curl -u ${USERNAME}:${PASSWORD} --data-binary \"@${fileName}.vsix\" -H \"Content-Type: application/octet-stream\" -X PUT ${uploadUrlArtifactory}"
      }
    },
    timeout: [
        time: 10,
        unit: 'MINUTES'
    ]
  )

  pipeline.createStage(
    name: "Check Firefox",
    stage: {
        sh "firefox --version | more"
    },
    timeout: [
        time: 2,
        unit: 'MINUTES'
    ]
  )

  pipeline.createStage(
    name: "Run Theia Test",
    stage: {
        failFast: true
        parallel "Start Theia browser": { 
            stage('Start Theia browser') {
                try {
                    timeout(time: 10, unit: 'MINUTES') { 
                        script {
                            dir ("/tmp/theia/theia/examples/browser") {
                                sh "pwd"
                                sh "ls"
                                pipeline.nvmShell "yarn run start"
                            }
                        }
                    }
                } catch (err) {
                    echo "Theia Browser ended"
                }
            }
        }, "Run Mocha Test": {
            stage("Run Mocha Test") {
              pipeline.nvmShell "npm run test:theia"
            }
        }
    }
  )

  pipeline.end()
}
