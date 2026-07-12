import {createHash} from 'node:crypto'
import {createReadStream} from 'node:fs'
import {pipeline} from 'node:stream/promises'

import * as exec from '@actions/exec'
import * as io from '@actions/io'

/** Parse `<hex>  <filename>` lines (sha256sum format) into a name→hex map. */
export function parseSha256Sums(content: string): Map<string, string> {
  const sums = new Map<string, string>()
  for (const line of content.split('\n')) {
    const m = /^([0-9a-fA-F]{64})[ *]+(\S.*)$/.exec(line.trim())
    if (m) sums.set(m[2]!.trim(), m[1]!.toLowerCase())
  }
  return sums
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256')
  await pipeline(createReadStream(path), hash)
  return hash.digest('hex')
}

/** Verify `filePath` against its SHA256SUMS entry; throws on any mismatch. */
export async function verifyChecksum(
  filePath: string,
  assetName: string,
  sumsContent: string
): Promise<void> {
  const expected = parseSha256Sums(sumsContent).get(assetName)
  if (!expected) {
    throw new Error(`SHA256SUMS has no entry for ${assetName}`)
  }
  const actual = await sha256File(filePath)
  if (actual !== expected) {
    throw new Error(`checksum mismatch for ${assetName}: expected ${expected}, got ${actual}`)
  }
}

/** Verify SLSA build provenance via `gh attestation verify`. */
export async function verifyAttestation(
  filePath: string,
  repository: string,
  token: string
): Promise<void> {
  const gh = await io.which('gh', false)
  if (!gh) {
    throw new Error(
      'gh CLI not found: attestation verification requires it ' +
        '(preinstalled on GitHub-hosted runners); install gh or set `verify: false`'
    )
  }
  await exec.exec(gh, ['attestation', 'verify', filePath, '--repo', repository], {
    env: {...(process.env as Record<string, string>), GH_TOKEN: token}
  })
}
