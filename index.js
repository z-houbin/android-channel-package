const fs = require('fs')
const path = require('path')
const core = require('@actions/core')
const child_process = require('child_process');
const signLib = require('./sign');

function buildPackage(cmd) {
    return new Promise(function (resolve, reject) {
        let data = child_process.execSync(cmd)
        if (data && data.indexOf('BUILD SUCCESSFUL') !== -1) {
            console.log('build package success')
            resolve();
        } else {
            logError('build package failed')
            reject();
        }
    })
}

function findApkFiles(directory) {
    return fs.readdirSync(directory, {withFileTypes: true})
        .filter(item => !item.isDirectory())
        .filter(item => item.name.endsWith('.apk'))
}

function logError(message) {
    core.setFailed(message)
}

function logInfo(message) {
    core.info(message)
}

async function isFileExists(path) {
    return new Promise(function (resolve, reject) {
        fs.access(path, fs.constants.R_OK, (err) => {
            if (err) {
                resolve(false)
            } else {
                resolve(true)
            }
        });
    })
}

async function main() {
    // 读取渠道配置文件
    let channelFileName = core.getInput('channelFile') || 'channel.json'
    let channelJSON = fs.readFileSync(channelFileName, 'utf8')
    channelJSON = JSON.parse(channelJSON)

    // 签名配置信息
    const buildDir = core.getInput('buildDirectory') || 'build'
    const output = core.getInput('output') || path.join('build', 'signed')

    const signingKeyBase64 = core.getInput('signingKeyBase64')
    const alias = core.getInput('alias')
    const keyStorePassword = core.getInput('keyStorePassword')
    const keyPassword = core.getInput('keyPassword')
    const signingKey = path.join(buildDir, 'signingKey.jks')
    const buildCommand = core.getInput('buildCommand')

    if (!fs.existsSync(output)) {
        fs.mkdirSync(output, {recursive: true})
    }
    if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir, {recursive: true})
    }


    fs.writeFileSync(signingKey, signingKeyBase64, 'base64')

    logInfo('sign.file: ' + signingKey)

    logInfo('sign.file.exist: ' + await isFileExists(signingKey))
    logInfo('sign.file.exist2: ' + await isFileExists('build/signingKey.jks'))

    let releaseDirectory = core.getInput('releaseDirectory')

    for (let key in channelJSON) {
        logInfo('build.channel: ' + key)
        // 打渠道包
        await buildPackage(buildCommand + ' -PCHANNEL=' + key)
        logInfo('build.package finish')
        // 签名渠道包
        let apkFiles = findApkFiles(releaseDirectory)
        for await (let releaseFile of apkFiles) {
            const releaseFilePath = path.join(releaseDirectory, releaseFile.name)
            let signedReleaseFile = await signLib.signApkFile(releaseFilePath, signingKey, alias, keyStorePassword, keyPassword)
            fs.copyFileSync(signedReleaseFile, path.join(output, signedReleaseFile.split(/(\\|\/)/g).pop() || releaseFile.name))
        }
    }
}


main().then(function () {
    logInfo('main finished');
})