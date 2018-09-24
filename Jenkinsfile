pipeline {
    agent {
        label 'ca-jenkins-agent'
    }
  stages {
    stage('install dependencies') {
      steps {
        sh '''npm config set @brightside:registry https://api.bintray.com/npm/ca/brightside
              npm install'''
      }
    }
    /**
     * Build separately even though the deploy step also builds so that we can get 
     * any build errors 
     */
     stage('build') {
      steps {
        sh 'cp ./resources/testProfileData.example.ts ./resources/testProfileData.ts' // this file is required for build 
        sh 'npm run build'
      }
    }
    stage('Deploy') {
      steps {
        withCredentials([string(credentialsId: 'vscode-publish-token', variable: 'VSC_TOKEN')]) {
        sh 'npx vsce publish -p $VSC_TOKEN'
        }
      }
    }
  }
}