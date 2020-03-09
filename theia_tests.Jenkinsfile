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

  pipeline.admins.add("jackjia")

  pipeline.setup(
    packageName: 'ze-regression-test'
  )

  // build stage is required
  pipeline.build(
    operation: {
      echo "Install yarn"
      sh "yarn --version"
      echo "Build Theia"
      sh "git clone https://github.com/eclipse-theia/theia""
      sh "node -v"
      sh "pwd"
      sh "cd theia"
      sh "yarn"
      echo "Copy vsix to plugins folder"
      sh "mkdir -p plugins"
      sh "cd plugins"
      sh "bash -c 'curl https://zowe.jfrog.io/zowe/libs-release-local/org/zowe/vscode/vscode-extension-for-zowe-v1.1.0.vsix -o vscode-extension-for-zowe-v1.1.0.vsix'"
      sh "cd .."
      sh "cd .."
      sh "firefox --version | more"
    }
  )

  pipeline.test(
    name          : "Unit",
    operation         : {
      echo 'Skip until test case are embeded into this pipeline.'
    },
    allowMissingJunit : true
  )

  pipeline.end()
}
