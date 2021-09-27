import path from "path";
import {signApkFile} from "./sign";

const fs = require('fs')
const core = require('@actions/core')
const child_process = require('child_process');
const decoder = new TextDecoder('gbk');

function buildPackage(cmd) {
    return new Promise(function (resolve, reject) {
        let data = decoder.decode(child_process.execSync(cmd))
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
    console.log(message)
    core.error(message)
    core.setFailed(message)
}

function logInfo(message) {
    console.log(message)
    core.info(message)
}

async function main() {
    // 读取渠道配置文件
    let channelFileName = core.getInput('channelFile') || 'channel.json'
    let channelJSON = fs.readFileSync(channelFileName, 'utf8')
    channelJSON = JSON.parse(channelJSON)

    // 签名配置信息
    const buildDir = core.getInput('buildDirectory') ?? 'build'
    const output = core.getInput('output') ?? path.join('build', 'signed')

    const signingKeyBase64 = core.getInput('signingKeyBase64')
    const alias = core.getInput('alias')
    const keyStorePassword = core.getInput('keyStorePassword')
    const keyPassword = core.getInput('keyPassword')
    const signingKey = path.join(buildDir, 'signingKey.jks')
    const buildCommand = core.getInput('buildCommand')
    fs.writeFileSync(signingKey, signingKeyBase64, 'base64')
    if (!fs.existsSync(output)) {
        fs.mkdirSync(output, {recursive: true})
    }

    let releaseDirectory = core.getInput('releaseDirectory')

    for (let key in channelJSON) {
        logInfo('build.channel: ' + key)
        // 打渠道包
        await buildPackage(buildCommand + ' -PCHANNEL=' + key)
        // 签名渠道包
        let apkFiles = findApkFiles(releaseDirectory)
        for (let releaseFile of apkFiles) {
            const releaseFilePath = path.join(releaseDirectory, releaseFile.name)
            let signedReleaseFile = await signApkFile(releaseFilePath, signingKey, alias, keyStorePassword, keyPassword)
            fs.copyFileSync(signedReleaseFile, path.join(output, signedReleaseFile.split(/(\\|\/)/g).pop() ?? releaseFile.name))
        }
    }
}


main().then(function () {
    logInfo('main finished');
})