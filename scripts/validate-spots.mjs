// Validates every spots/*.json against schema/spot.schema.json.
// Exit code 1 on any failure so it can gate CI and `npm run check`.
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const schemaPath = path.join(root, 'schema', 'spot.schema.json')
const spotsDir = path.join(root, 'spots')

const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
const validate = ajv.compile(JSON.parse(await readFile(schemaPath, 'utf8')))

const files = (await readdir(spotsDir)).filter((f) => f.endsWith('.json')).sort()
let failed = 0
const seenIds = new Map()

for (const file of files) {
  const data = JSON.parse(await readFile(path.join(spotsDir, file), 'utf8'))
  const problems = []

  if (!validate(data)) {
    for (const e of validate.errors ?? []) problems.push(`${e.instancePath || '/'} ${e.message}`)
  }
  // Cross-file and cross-field rules the schema language cannot express.
  const expectedId = path.basename(file, '.json')
  if (data.id && data.id !== expectedId) problems.push(`id "${data.id}" must match filename "${expectedId}"`)
  if (data.id && seenIds.has(data.id)) problems.push(`duplicate id "${data.id}" also in ${seenIds.get(data.id)}`)
  seenIds.set(data.id, file)
  if (data.viewpoint?.confidence === 'surveyed' && !data.viewpoint.surveyed_at)
    problems.push('viewpoint.surveyed_at is required when confidence is "surveyed"')
  if (data.status === 'published' && data.viewpoint?.confidence !== 'surveyed')
    problems.push('status "published" requires viewpoint.confidence "surveyed"')
  if (data.status === 'published' && !data.present)
    problems.push('status "published" requires a present photo for remote mode')

  if (problems.length === 0) {
    console.log(`ok    ${file}`)
  } else {
    failed++
    console.log(`FAIL  ${file}`)
    for (const p of problems) console.log(`        ${p}`)
  }
}

console.log(`\n${files.length - failed}/${files.length} spot files valid`)
process.exit(failed === 0 ? 0 : 1)
