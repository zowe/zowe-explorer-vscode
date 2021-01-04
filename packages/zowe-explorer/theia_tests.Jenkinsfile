/*
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 */

node('zowe-jenkins-agent-dind') {
  def lib = library("jenkins-library").org.zowe.jenkins_shared_library

  def pipeline = lib.pipelines.nodejs.NodeJSPipeline.new(this)

  def packagingDir = '.tmp'
  def packageName = 'vscode-extension-for-zowe'

  pipeline.admins.add("jackjia")

  pipeline.setup(
    packageName: 'org.zowe.vscode',
    nodeJsVersion: 'v10.18.1',
    // FIXME: this line should be removed after fix the audit error
    ignoreAuditFailure: true
  )

  pipeline.createStage(
    name          : "Verify Environment",
    isSkippable   : true,
    stage         : {
      echo "Firefox version is:"
      sh "firefox --version | more"
    }
  )

  // we have a custom build command
  pipeline.build(
    operation: {
      ansiColor('xterm') {
        sh "cp resources/testProfileData.example.ts resources/testProfileData.ts"
        pipeline.nvmShell "npm run build"

        // Generate a vsix for archiving purposes
        sh "mkdir -p ${packagingDir}/plugins && mkdir -p ${packagingDir}/screenshots && chmod -R 777 ${packagingDir}"
        pipeline.nvmShell "npx vsce package -o ${packagingDir}/plugins/${packageName}.vsix"
      }
    }
  )

  pipeline.createStage(
    name          : "Start Theia",
    timeout       : [ time: 10, unit: 'MINUTES' ],
    isSkippable   : true,
    stage         : {
      echo ">> Start Thiea in docker"
      sh "docker run -d -p 3000:3000 -v \"\$(pwd)/${packagingDir}:/home/theia/.theia\" -u theia theiaide/theia"

      echo ">> Wait for 2 minutes to give time for Theia to be started"
      sleep time: 2, unit: 'MINUTES'

      echo ">> Try to access localhost:3000 and see if it's available"
      sh "firefox -headless --screenshot ${packagingDir}/screenshots/firefox-test.jpg http://localhost:3000/"

      echo ">> Show container logs"
      sh "docker logs \$(docker ps -q)"

      echo ">> Show files in theia working folder"
      sh "find ${packagingDir} -type f -maxdepth 3"
    }
  )

  pipeline.test(
    name          : 'Theia',
    timeout       : [ time: 10, unit: 'MINUTES' ],
    operation     : {
      ansiColor('xterm') {
        pipeline.nvmShell "npm run test:theia"
      }
    },
    // FIXME: once we publish test result as junit, we can disable below line
    allowMissingJunit : true
    // example way to define junit file
    // junit         : "path/to/junit.xml",
    // example way to define html report
    // htmlReports   : [
    //   [dir: "path/to/html/reports", files: "index.html", name: "Report: Theia Test"],
    // ],
  )

  // define we need publish stage
  pipeline.publish(
    operation: {
      echo "Default npm publish will be skipped."
    },
    artifacts: [
      "${packagingDir}/plugins/${packageName}.vsix",
      // "${packagingDir}/screenshots/*.png"
    ]
  )

  pipeline.end()
}
