import {promises as fs} from 'node:fs'
import * as path from 'node:path'

import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'

import type {Release} from './resolve'
import {verifyAttestation, verifyChecksum} from './verify'

export const TOOL = 'gobottle'

/** Map a node platform/arch pair onto the goreleaser artifact matrix. */
export function platformSlug(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): {os: string; arch: string} {
  const os = {darwin: 'darwin', linux: 'linux'}[platform as string]
  const goarch = {x64: 'amd64', arm64: 'arm64'}[arch]
  if (!os || !goarch) {
    throw new Error(
      `unsupported platform ${platform}/${arch}: gobottle releases cover darwin/linux on amd64/arm64`
    )
  }
  return {os, arch: goarch}
}

export interface InstallOptions {
  release: Release
  repository: string
  token: string
  verify: boolean
}

export interface InstallResult {
  version: string
  path: string
  cacheHit: boolean
}

function findAsset(release: Release, name: string): {name: string; url: string} {
  const asset = release.assets.find(a => a.name === name)
  if (!asset) {
    throw new Error(
      `release ${release.tag} has no asset ${name} (assets: ${release.assets.map(a => a.name).join(', ')})`
    )
  }
  return asset
}

async function download(url: string, token: string): Promise<string> {
  return tc.downloadTool(url, undefined, `Bearer ${token}`, {
    accept: 'application/octet-stream'
  })
}

export async function install(opts: InstallOptions): Promise<InstallResult> {
  const {release, repository, token, verify} = opts
  const version = release.tag.replace(/^v/, '')
  const {os, arch} = platformSlug()

  const cached = tc.find(TOOL, version, arch)
  if (cached) {
    core.info(`found ${TOOL} ${version} in tool cache`)
    core.addPath(cached)
    return {version, path: cached, cacheHit: true}
  }

  const zipName = `${TOOL}_${version}_${os}_${arch}.zip`
  const sumsName = `${TOOL}_${version}_SHA256SUMS`

  core.info(`downloading ${zipName} from ${repository} ${release.tag}`)
  const zipPath = await download(findAsset(release, zipName).url, token)
  const sumsPath = await download(findAsset(release, sumsName).url, token)

  await verifyChecksum(zipPath, zipName, await fs.readFile(sumsPath, 'utf8'))
  core.info('checksum verified')

  if (verify) {
    await verifyAttestation(zipPath, repository, token)
    core.info('build provenance verified')
  }

  const extracted = await tc.extractZip(zipPath)
  await fs.chmod(path.join(extracted, TOOL), 0o755)
  const toolPath = await tc.cacheDir(extracted, TOOL, version, arch)
  core.addPath(toolPath)

  await exec.exec(path.join(toolPath, TOOL), ['version'])

  return {version, path: toolPath, cacheHit: false}
}
