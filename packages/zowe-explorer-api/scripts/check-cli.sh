# Checks to ensure that the Zowe CLI dependency is accessible from the API.
# This will prevent usage of the API without the required CLI dependency.

CURRENT_DIR=$(pwd)
ZE_API_PREFIX="[Zowe Explorer API]"
echo "$ZE_API_PREFIX Checking for CLI in node_modules..."

# Determines whether the CLI is accessible from the API.
find_cli() {
    if [[ $(ls | grep "@zowe") ]]; then
        cd "@zowe"
        if [[ $(ls | grep "cli") ]]; then
            echo "$ZE_API_PREFIX OK - Zowe CLI was found in node_modules."
            return 0
        else
            echo "$ZE_API_PREFIX ERR - Zowe CLI was not found in node_modules."
            return 1
        fi
    else
        echo "$ZE_API_PREFIX ERR - Zowe CLI was not found in node_modules."
        return 1
    fi
}

if [[ $(echo $CURRENT_DIR | grep 'packages/zowe-explorer-api') ]]; then
    # in the context of the Zowe Explorer repo, within API folder
    cd ../../node_modules/
    find_cli
elif [[ $(echo $CURRENT_DIR | grep 'node_modules') ]]; then
    # directory is likely in format /.../node_modules/@zowe/zowe-explorer-api
    cd ../../
    find_cli
else
    # default: assume node_modules is in same folder
    cd node_modules/
    find_cli
fi