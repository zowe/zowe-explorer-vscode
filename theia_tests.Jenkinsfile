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

  pipeline.admins.add("crawr")

  pipeline.setup(
    packageName: 'ze-regression-test'
  )

  // build stage is required
  pipeline.build(
    operation: {
      echo "build holder"
    }
  )

  pipeline.test(
    name          : "Unit",
    operation         : {
      echo 'Skip until test case are embeded into this pipeline.'
    },
    allowMissingJunit : true
  )

  // define we need publish stage
  pipeline.publish()

  // define we need release stage
  pipeline.release()

  pipeline.end()
}