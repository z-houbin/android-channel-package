const fs = require('fs')

let util = Object.assign({})

util.isFileExists = async function (path) {
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

util.statSync = function (path) {
    return fs.statSync(path)
}


module.exports = util