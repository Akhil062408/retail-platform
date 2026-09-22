pipeline {

    agent any

    parameters {

        choice(
            name: 'DEPLOYMENT_ACTION',
            choices: ['DEPLOY', 'ROLLBACK'],
            description: 'Deployment action'
        )

        choice(
            name: 'ENVIRONMENT',
            choices: ['UAT', 'PRODUCTION'],
            description: 'Deployment environment'
        )

        string(
            name: 'VERSION',
            defaultValue: '4.2.1',
            description: 'Version to deploy, example: 4.2.1'
        )

        choice(
            name: 'CONFIRM_PROD',
            choices: ['YES', 'NO'],
            description: 'Must be YES for production deployment'
        )
    }

    environment {

        IMAGE_NAME = 'retail-app'

        NETWORK_NAME = 'retail-network'

        PROD_CONTAINER = 'retail-app'

        CANDIDATE_CONTAINER = 'retail-app-candidate'

        PROD_PORT = '8081'

        CANDIDATE_PORT = '8082'
    }

    stages {

        stage('Validate Parameters') {

            steps {

                script {

                    echo "=========================================="
                    echo "DEPLOYMENT ACTION : ${params.DEPLOYMENT_ACTION}"
                    echo "ENVIRONMENT       : ${params.ENVIRONMENT}"
                    echo "VERSION           : ${params.VERSION}"
                    echo "CONFIRM PROD      : ${params.CONFIRM_PROD}"
                    echo "=========================================="

                    if (
                        params.ENVIRONMENT == 'PRODUCTION' &&
                        params.DEPLOYMENT_ACTION == 'DEPLOY' &&
                        params.CONFIRM_PROD != 'YES'
                    ) {

                        error(
                            "PRODUCTION deployment blocked. CONFIRM_PROD must be YES."
                        )
                    }

                    if (!params.VERSION.matches(/^[0-9]+\.[0-9]+\.[0-9]+$/)) {

                        error(
                            "Invalid version format: ${params.VERSION}"
                        )
                    }
                }
            }
        }

        stage('Validate Git Tag') {

            steps {

                script {

                    def tagName = "v${params.VERSION}"

                    echo "Validating Git tag: ${tagName}"

                    bat """
                        git fetch --tags
                        git rev-parse refs/tags/${tagName}
                    """

                    def commitId = bat(
                        script: "git rev-list -n 1 ${tagName}",
                        returnStdout: true
                    ).trim()

                    echo "=========================================="
                    echo "SELECTED GIT TAG    : ${tagName}"
                    echo "SELECTED GIT COMMIT : ${commitId}"
                    echo "=========================================="
                }
            }
        }

        stage('Checkout Requested Version') {

            steps {

                bat """
                    git checkout --force v${params.VERSION}
                """

                bat """
                    git status
                """
            }
        }

        stage('Build Docker Image') {

            when {

                expression {
                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {

                echo "Building Docker image: ${IMAGE_NAME}:${params.VERSION}"

                bat """
                    docker build -t ${IMAGE_NAME}:${params.VERSION} .
                """

                bat """
                    docker images ${IMAGE_NAME}
                """
            }
        }

        stage('Prepare Docker Network') {

            steps {

                bat """
                    docker network inspect ${NETWORK_NAME} >nul 2>&1 || docker network create ${NETWORK_NAME}
                """
            }
        }

        stage('Record Previous Production') {

            when {

                expression {

                    params.ENVIRONMENT == 'PRODUCTION' &&
                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {

                script {

                    def containerExists = bat(
                        script: """
                            @docker inspect ${PROD_CONTAINER} >nul 2>&1
                        """,
                        returnStatus: true
                    )

                    if (containerExists == 0) {

                        env.PREVIOUS_IMAGE = bat(
                            script: """
                                @docker inspect ${PROD_CONTAINER} --format="{{.Config.Image}}"
                            """,
                            returnStdout: true
                        ).trim()

                        echo "OLD PRODUCTION IMAGE: ${env.PREVIOUS_IMAGE}"

                    } else {

                        env.PREVIOUS_IMAGE = ""

                        echo "No existing production container found."
                    }
                }
            }
        }

        stage('Start New Version') {

            when {

                expression {

                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {

                script {

                    echo "NEW VERSION: ${params.VERSION}"

                    bat """
                        docker rm -f ${CANDIDATE_CONTAINER} >nul 2>&1 || exit /b 0
                    """

                    def healthStatus = "UP"

                    /*
                     * Mandatory failure injection.
                     *
                     * Version 4.2.2 starts normally but its
                     * /health endpoint returns HTTP 503.
                     */

                    if (params.VERSION == "4.2.2") {

                        healthStatus = "DOWN"

                        echo "=========================================="
                        echo "FAILURE INJECTION ENABLED"
                        echo "VERSION: 4.2.2"
                        echo "HEALTH_STATUS: DOWN"
                        echo "=========================================="
                    }

                    bat """
                        docker run -d ^
                        --name ${CANDIDATE_CONTAINER} ^
                        --network ${NETWORK_NAME} ^
                        -p ${CANDIDATE_PORT}:8081 ^
                        -e PORT=8081 ^
                        -e VERSION=${params.VERSION} ^
                        -e HEALTH_STATUS=${healthStatus} ^
                        ${IMAGE_NAME}:${params.VERSION}
                    """

                    echo "New version started as candidate container."
                }
            }
        }

        stage('Candidate Health Check') {

            when {

                expression {

                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {

                script {

                    echo "Checking candidate application health..."

                    bat """
                        powershell -Command "Start-Sleep -Seconds 5"
                    """

                    def result = bat(
                        script: """
                            powershell -Command "\$r=Invoke-WebRequest http://localhost:${CANDIDATE_PORT}/health -UseBasicParsing -ErrorAction SilentlyContinue; if (\$r.StatusCode -eq 200) { Write-Host 'HEALTH CHECK PASSED'; exit 0 } else { Write-Host 'HEALTH CHECK FAILED'; exit 1 }"
                        """,
                        returnStatus: true
                    )

                    if (result != 0) {

                        error(
                            "CANDIDATE HEALTH CHECK FAILED"
                        )
                    }

                    echo "CANDIDATE HEALTH CHECK PASSED"
                }
            }
        }

        stage('Switch Production') {

            when {

                expression {

                    params.ENVIRONMENT == 'PRODUCTION' &&
                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {

                script {

                    echo "=========================================="
                    echo "OLD VERSION: ${env.PREVIOUS_IMAGE}"
                    echo "NEW VERSION: ${IMAGE_NAME}:${params.VERSION}"
                    echo "=========================================="

                    /*
                     * The new version has already passed the
                     * candidate health check.
                     *
                     * Only now do we remove the old container.
                     */

                    bat """
                        docker rm -f ${PROD_CONTAINER} >nul 2>&1 || exit /b 0
                    """

                    bat """
                        docker run -d ^
                        --name ${PROD_CONTAINER} ^
                        --network ${NETWORK_NAME} ^
                        -p ${PROD_PORT}:8081 ^
                        -e PORT=8081 ^
                        -e VERSION=${params.VERSION} ^
                        -e HEALTH_STATUS=UP ^
                        ${IMAGE_NAME}:${params.VERSION}
                    """

                    bat """
                        docker rm -f ${CANDIDATE_CONTAINER} >nul 2>&1 || exit /b 0
                    """

                    echo "Production switched to ${params.VERSION}"
                }
            }
        }

        stage('Final Production Health Check') {

            when {

                expression {

                    params.ENVIRONMENT == 'PRODUCTION' &&
                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {

                script {

                    echo "Checking final production health..."

                    bat """
                        powershell -Command "Start-Sleep -Seconds 5"
                    """

                    def result = bat(
                        script: """
                            powershell -Command "\$r=Invoke-WebRequest http://localhost:${PROD_PORT}/health -UseBasicParsing -ErrorAction SilentlyContinue; if (\$r.StatusCode -eq 200) { Write-Host 'PRODUCTION HEALTH CHECK PASSED'; exit 0 } else { Write-Host 'PRODUCTION HEALTH CHECK FAILED'; exit 1 }"
                        """,
                        returnStatus: true
                    )

                    if (result != 0) {

                        error(
                            "FINAL PRODUCTION HEALTH CHECK FAILED"
                        )
                    }

                    echo "FINAL PRODUCTION HEALTH CHECK PASSED"
                }
            }
        }

        stage('Manual Rollback') {

            when {

                expression {

                    params.DEPLOYMENT_ACTION == 'ROLLBACK'
                }
            }

            steps {

                script {

                    echo "MANUAL ROLLBACK REQUESTED"

                    if (!params.VERSION) {

                        error("Rollback VERSION is required.")
                    }

                    bat """
                        docker rm -f ${PROD_CONTAINER} >nul 2>&1 || exit /b 0
                    """

                    bat """
                        docker run -d ^
                        --name ${PROD_CONTAINER} ^
                        --network ${NETWORK_NAME} ^
                        -p ${PROD_PORT}:8081 ^
                        -e PORT=8081 ^
                        -e VERSION=${params.VERSION} ^
                        -e HEALTH_STATUS=UP ^
                        ${IMAGE_NAME}:${params.VERSION}
                    """

                    echo "Rollback version ${params.VERSION} started."
                }
            }
        }

        stage('Verify Docker') {
            steps {
                bat '''
                    echo Checking Docker...
                    where docker
                    docker --version
                    docker info
                '''
            }
        }
    }

    post {

        failure {

            script {

                if (
                    params.DEPLOYMENT_ACTION == 'DEPLOY' &&
                    params.ENVIRONMENT == 'PRODUCTION'
                ) {

                    echo "=========================================="
                    echo "AUTOMATIC ROLLBACK STARTED"
                    echo "FAILED VERSION: ${params.VERSION}"
                    echo "PREVIOUS IMAGE: ${env.PREVIOUS_IMAGE}"
                    echo "=========================================="

                    /*
                     * Remove failed candidate.
                     */

                    bat """
                        docker rm -f ${CANDIDATE_CONTAINER} >nul 2>&1 || exit /b 0
                    """

                    /*
                     * If production was already switched,
                     * restore the previous production image.
                     */

                    if (env.PREVIOUS_IMAGE) {

                        echo "RESTORING PREVIOUS PRODUCTION IMAGE"

                        bat """
                            docker rm -f ${PROD_CONTAINER} >nul 2>&1 || exit /b 0
                        """

                        bat """
                            docker run -d ^
                            --name ${PROD_CONTAINER} ^
                            --network ${NETWORK_NAME} ^
                            -p ${PROD_PORT}:8081 ^
                            -e PORT=8081 ^
                            -e VERSION=4.2.1 ^
                            -e HEALTH_STATUS=UP ^
                            ${env.PREVIOUS_IMAGE}
                        """

                        bat """
                            powershell -Command "Start-Sleep -Seconds 5"
                        """

                        bat """
                            powershell -Command "\$r=Invoke-WebRequest http://localhost:${PROD_PORT}/health -UseBasicParsing -ErrorAction SilentlyContinue; if (\$r.StatusCode -eq 200) { Write-Host 'ROLLBACK HEALTH CHECK PASSED' } else { Write-Host 'ROLLBACK HEALTH CHECK FAILED'; exit 1 }"
                        """

                        echo "=========================================="
                        echo "ROLLBACK VERIFIED"
                        echo "RESTORED VERSION: 4.2.1"
                        echo "FINAL STATE: PREVIOUS VERSION RESTORED"
                        echo "=========================================="

                    } else {

                        echo "No previous production image was recorded."
                    }
                }
            }
        }

        success {

            echo "=========================================="
            echo "DEPLOYMENT SUCCESSFUL"
            echo "VERSION: ${params.VERSION}"
            echo "ENVIRONMENT: ${params.ENVIRONMENT}"
            echo "=========================================="
        }
    }
}