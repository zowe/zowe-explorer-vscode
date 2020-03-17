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
            sh "mkdir -p plugins"
            dir ("plugins") {
              sh "bash -c 'curl https://zowe.jfrog.io/zowe/libs-release-local/org/zowe/vscode/vscode-extension-for-zowe-v1.1.0.vsix -o vscode-extension-for-zowe-v1.1.0.vsix'"
              sh "pwd"
              sh "ls"
            }
            sh "cd .."
            sh "pwd"
          }
      }
    },
    timeout: [
        time: 20,
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
        parallel stageTests1: { 
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
        }, stageTest2: {
            stage('Run Mocha Test') {
              sh "pwd"
              sh "ls"
              sh "cp resources/testProfileData.example.ts resources/testProfileData.ts"
              pipeline.nvmShell "npm run build"
              pipeline.nvmShell "npm run test:theia"
            }
        }
    }
  )

  pipeline.end()
}
