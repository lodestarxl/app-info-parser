const Zip = require('./zip')
const parsePlist = require('plist').parse
const parseBplist = require('bplist-parser').parseBuffer
const cgbiToPng = require('cgbi-to-png')

const { findIpaIconPath, getBase64FromBuffer } = require('./utils')

const PlistName = new RegExp('payload/.+?.app/info.plist$', 'i')
const ProvisionName = /payload\/.+?\.app\/embedded.mobileprovision/

class IpaParser extends Zip {
  constructor (file) {
    super(file)
    if (!(this instanceof IpaParser)) {
      return new IpaParser(file)
    }
  }
  parse () {
    return new Promise((resolve, reject) => {
      this.getEntries([PlistName, ProvisionName]).then(buffers => {
        if (!buffers[PlistName]) {
          throw new Error('Info.plist can\'t be found.')
        }
        // 解析 plist
        const plistInfo = this._parsePlist(buffers[PlistName])
        // 解析 mobileprovision
        const provisionInfo = this._parseProvision(buffers[ProvisionName])
        plistInfo.mobileProvision = provisionInfo

        // 解析 ipa安装包图标
        const iconRegex = new RegExp(findIpaIconPath(plistInfo).toLowerCase())
        this.getEntry(iconRegex).then(iconBuffer => {
          // ipa安装包的图标被特殊处理过，需要经过转换
          plistInfo.icon = iconBuffer ? getBase64FromBuffer(cgbiToPng.revert(iconBuffer)) : null
          resolve(plistInfo)
        }).catch(e => {
          reject(e)
        })
      }).catch(e => {
        reject(e)
      })
    })
  }
  /**
   * 解析plist文件
   * @param {Buffer} buffer // 要解析的plist文件buffer
   */
  _parsePlist (buffer) {
    let result
    const bufferType = buffer[0]
    if (bufferType === 60 || bufferType === '<' || bufferType === 239) {
      result = parsePlist(buffer.toString())
    } else if (bufferType === 98) {
      result = parseBplist(buffer)[0]
    } else {
      throw new Error('Unknow plist buffer type.')
    }
    return result
  }
  /**
   * 解析provision文件
   * @param {Buffer} buffer // 要解析的plist文件buffer
   */
  _parseProvision (buffer) {
    let info = {}
    if (buffer) {
      info = buffer.toString('utf-8')
      const firstIndex = info.indexOf('<')
      const endIndex = info.indexOf('</plist>')
      info = info.slice(firstIndex, endIndex + 8)
      info = parsePlist(info)
    }
    return info
  }
}

module.exports = IpaParser
