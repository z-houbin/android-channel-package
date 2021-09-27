const exec = require('@actions/exec')
const core = require('@actions/core')
const path = require('path')
const fs = require('fs')
const util = require('./util')


let sign = Object.assign({})

sign.signApkFile = async function (apkFile, signingKeyFile, alias, keyStorePassword, keyPassword) {
    core.info("signApkFile: " + apkFile + " " + signingKeyFile + " " + alias + " " + keyStorePassword + " " + keyPassword);

    // Find zipalign executable
    const buildToolsVersion = process.env.BUILD_TOOLS_VERSION || '30.0.2';
    const androidHome = process.env.ANDROID_HOME;
    if (!androidHome) {
        core.error("require ANDROID_HOME to be execute");
        throw new Error("ANDROID_HOME is null");
    }
    const buildTools = path.join(androidHome, `build-tools/${buildToolsVersion}`);
    if (!fs.existsSync(buildTools)) {
        core.error(`Couldnt find the Android build tools @ ${buildTools}`)
    }

    const zipAlign = path.join(buildTools, 'zipalign');
    core.info(`Found 'zipalign' @ ${zipAlign}`);

    // Align the apk file
    const alignedApkFile = apkFile.replace('.apk', '-aligned.apk');
    await exec.exec(`"${zipAlign}"`, [
        '-c',
        '-v', '4',
        apkFile
    ]);

    await exec.exec(`"cp"`, [
        apkFile,
        alignedApkFile
    ]);

    core.info("Signing APK file");

    // find apksigner path
    const apkSigner = path.join(buildTools, 'apksigner');
    core.info(`Found 'apksigner' @ ${apkSigner}`);

    // apksigner sign --ks my-release-key.jks --out my-app-release.apk my-app-unsigned-aligned.apk
    const signedApkFile = apkFile.replace('.apk', '-signed.apk');
    const args = [
        'sign',
        '--ks', signingKeyFile,
        '--ks-key-alias', alias,
        '--ks-pass', `pass:${keyStorePassword}`,
        '--out', signedApkFile
    ];

    if (keyPassword) {
        args.push('--key-pass', `pass:${keyPassword}`);
    }
    args.push(alignedApkFile);

    core.info('args: ' + args)

    core.info('sing.file.exists::::' + await util.isFileExists(signingKeyFile))

    await exec.exec(`"${apkSigner}"`, args);

    // Verify
    core.info("Verifying Signed APK");
    //await exec.exec(`"${apkSigner}"`, [
    //    'verify',
    //    signedApkFile
    //]);

    return signedApkFile
}

module.exports = sign