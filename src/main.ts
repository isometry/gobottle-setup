import * as core from '@actions/core'

import {install} from './install'
import {resolveRelease} from './resolve'

async function run(): Promise<void> {
  const spec = core.getInput('version') || 'latest'
  const repository = core.getInput('repository') || 'isometry/gobottle'
  const token = core.getInput('token', {required: true})
  const verify = core.getBooleanInput('verify')

  const release = await resolveRelease(spec, repository, token)
  core.info(`resolved version spec '${spec}' to ${release.tag}`)

  const result = await install({release, repository, token, verify})

  core.setOutput('version', result.version)
  core.setOutput('path', result.path)
  core.setOutput('cache-hit', String(result.cacheHit))
}

run().catch((err: Error) => core.setFailed(err.message))
