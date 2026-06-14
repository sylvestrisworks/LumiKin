/**
 * _gen-editorial-image.ts — generate a house-style editorial illustration via
 * Imagen 4.0 on Vertex (project curametrics-492614, region us-central1).
 *
 * House style (locked, see memory project_editorial_illustration):
 *   linocut / engraving, deep charcoal ink on warm cream paper, single
 *   crimson-red accent. Colors in WORDS never hex. Hard no-text negatives.
 *
 * Auth: GOOGLE_CREDENTIALS_JSON (service-account JSON) — same as vertex-ai.ts.
 *
 *   npx tsx scripts/_gen-editorial-image.ts <key> <aspect> [count]
 *     <key>    one of the PROMPTS keys below
 *     <aspect> 1:1 | 3:4 | 4:3 | 16:9 | 9:16
 *     [count]  samples to generate (default 2) → .tmp/gen/<key>-<n>.png
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { createSign } from 'crypto'
import { mkdirSync, writeFileSync } from 'fs'

const PROJECT = 'curametrics-492614'
const MODEL = 'imagen-4.0-generate-001'
const ENDPOINT = `https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/us-central1/publishers/google/models/${MODEL}:predict`

const STYLE =
  'Bold linocut / woodcut engraving print. Deep charcoal-black ink on warm cream ' +
  'paper, with a single crimson-red spot-color accent. Hand-carved relief texture, ' +
  'visible gouge marks and hatching. Vintage children\'s-book printmaking feel, ' +
  'warm and inviting, gaming-positive. The composition fills the entire frame edge ' +
  'to edge with balanced visual weight — no large empty margins.'

const NEGATIVE =
  'no text, no words, no letters, no numbers, no typography, no captions, no logos, ' +
  'no watermark, no signature, no labels on any object, every object blank and ' +
  'unmarked, no UI, no photograph, no 3d render, no gradient mesh, no neon, ' +
  'no empty corners, not a centered vignette on blank background, ' +
  'no numbers or tick-marks on dials gauges or meters, blank unmarked dial faces.'

const PROMPTS: Record<string, string> = {
  // Guide: base-game scoring / a single purchase that bundles single-player +
  // online. A full-bleed scene, not a centered motif on void.
  'bundled-online-modes':
    'A single open game box in the lower center, its lid raised, two worlds growing ' +
    'out of it and spreading across the whole width: to the LEFT a quiet single-player ' +
    'adventure — rolling mountains, a winding path, a lone small hero; to the RIGHT a ' +
    'lively shared online arena — several small friendly figures playing together, ' +
    'banners and arches. The two halves mirror each other and reach the left and right ' +
    'edges, one connected landscape. ' + STYLE,

  // Homepage hero — wide backdrop. Visual weight pushed RIGHT so the left stays
  // calmer for the headline overlay. Inviting "storybook of play".
  'hero':
    'A wide panoramic scene. On the RIGHT, a large open atlas-like book stands upright; ' +
    'out of its pages a whole world of play rises like a paper pop-up — friendly ' +
    'mountains, a small castle, building blocks, stars, a kite, a gentle dragon, a tiny ' +
    'controller, children exploring. The wonder is densest on the right and tapers ' +
    'gently toward the LEFT, which is open calm sky and a few drifting stars. Warm, ' +
    'expansive, reassuring — a parent\'s guide to the worlds their children play in. ' +
    STYLE,

  // Blog cover: the studio behind the hooks. A friendly cutaway "engine room"
  // that powers a tiny mobile-game world above — the engineered-engagement
  // machine, shown warmly, not menacingly. Full-bleed, balanced weight.
  'supercell-mechanics':
    'A cutaway cross-section of a great cheerful clockwork machine that fills the ' +
    'whole frame. Across the TOP it powers a tiny lively mobile-game world — a small ' +
    'walled village with a builder hut, a little arena with two facing toy fighters, ' +
    'a star-shaped trophy. BELOW the surface, exposed like the inside of a music box: ' +
    'interlocking gears, a big winding key, several hourglasses and small clock-timers, ' +
    'a row of closed treasure chests riding a conveyor belt, and a coin slot. A few ' +
    'small friendly engineers tend the gears and wind the key. The machinery and the ' +
    'play-world are clearly one connected contraption, reaching all four edges. Warm, ' +
    'inventive, a little knowing — the works behind the fun made visible. ' + STYLE,

  // Blog cover: cinematic craft above, the cash-and-noise economy below. A
  // grand open-world story framed like theatre, propped up by a coin-fed
  // machine. Full-bleed, balanced, one connected scene.
  'rockstar-craft-vs-cash':
    'A theatre stage seen straight on, filling the whole frame. Heavy curtains at the ' +
    'top frame a sweeping cinematic open-world vista on the stage — a lone rider on a ' +
    'horse before tall mesas and a distant city skyline, a film reel doubling as the ' +
    'setting sun, richly detailed and beautiful. BELOW the stage floor, exposed like a ' +
    'cutaway, the same world is propped up by a big coin-operated machine: a large ' +
    'blank payment card sliding into a slot, stacks of coins, a pull-lever slot-machine ' +
    'drum, a small jostling crowd of tiny figures pushing toward the slot. The grand ' +
    'story above and the cash machine below are clearly one structure, reaching all ' +
    'four edges. Cinematic, masterful, with a knowing undertow. ' + STYLE,

  // Blog cover: Blizzard — the finished-craft era vs the live-service storefront.
  // A diptych workshop: a sealed, completed game on the left; the same world fed
  // through a coin-slot/subscription machine on the right; a frost-star over both.
  // Full-bleed, one connected scene, single crimson accent on the meter needle.
  'blizzard-craft-to-storefront':
    'A diptych composition filling the whole frame edge to edge, a single great ' +
    'six-pointed frost-star snowflake arching over the TOP center and linking both ' +
    'halves. On the LEFT, the craft era: a craftsman\'s workbench where a fantasy ' +
    'world sits finished and complete — a carved strategy map on a grid board, a ' +
    'hero\'s sword driven into an anvil, chisels and carving gouges set down at rest, ' +
    'a closed blank treasure chest, a sealed unmarked game box standing upright, calm ' +
    'and done. On the RIGHT, the same fantasy world is fed through a storefront ' +
    'machine: a coin-slot turnstile with a small queue of tiny figures feeding round ' +
    'tokens into it, a large round meter-gauge whose face is completely smooth and ' +
    'blank with absolutely no numbers, tick-marks or markings — only a single long ' +
    'sweeping needle like a ticking subscription clock, an endless conveyor treadmill ' +
    'looping back on itself, neat stacks of coins. The finished craft on the left and the recurring ' +
    'storefront on the right are clearly one connected workshop under the presiding ' +
    'frost-star. There are NO signs, placards, nameplates, banners or labels anywhere ' +
    'in the scene — every surface is blank. The image bleeds off all four edges and ' +
    'completely fills the frame with rich detail, no cream border or margin. The single ' +
    'long sweeping needle on the meter-gauge is the only crimson-red spot-color accent. ' +
    'Knowing and a little wistful — a great workshop that learned to charge by the ' +
    'hour. ' + STYLE,

  // Blog cover: how games changed across the century. A long river of play
  // flowing left→right: wholesome and open at the source, gradually wired with
  // coins, hooks and timers downstream — the same play, now mechanised. Warm,
  // knowing, gaming-positive, not frightening. Full-bleed.
  'century-of-play':
    'A long winding river flows from the far LEFT to the far RIGHT across the whole ' +
    'frame, filling it edge to edge. At its LEFT source the play is simple and ' +
    'wholesome — a child runs freely on an open hill, loose building blocks, a kite, a ' +
    'little castle, a few birds, wide calm sky. As the river flows toward the RIGHT it ' +
    'grows steadily busier and more tangled: along the banks and floating on the current ' +
    'appear small fishing hooks, looping clock-timers and hourglasses, a slot-machine ' +
    'pull-lever, stacked coins tumbling into the water, closed treasure chests riding the ' +
    'flow — the same play, now wired with mechanisms. The transformation is gradual and ' +
    'continuous along the river, not a hard split. The scene reaches all four edges with ' +
    'rich detail and no empty margin. A single coin mid-river is the only crimson-red ' +
    'spot-color accent. Warm, knowing, a little wry, gaming-positive — change observed, ' +
    'not feared. ' + STYLE,

  // Blog cover: the science behind the benefit score. A child's mind as a
  // cultivated garden — development as growth, not drilling. Full-bleed.
  'what-good-for-kids-means':
    'A child\'s head in gentle profile, large and filling the frame, the top of the ' +
    'skull opening like a flourishing garden instead of a brain: climbing vines, ' +
    'sprouting seedlings and leaves intertwined with a few friendly cogwheels, a blank ' +
    'jigsaw puzzle piece, a compass rose and a small open book with blank pages, all ' +
    'growing together. Roots run down the neck and tendrils spread into the top corners ' +
    'so the growth touches every edge. One single small seedling at the very center is ' +
    'the crimson-red spot-color accent. Warm, hopeful — a mind as a cultivated garden. ' +
    STYLE,

  // Blog cover: flow vs engineered arousal. A mirrored diptych — the calm,
  // self-paced child vs the wired, over-stimulated one. Full-bleed.
  'flow-not-just-fun':
    'The frame split vertically into two mirrored halves that together fill the whole ' +
    'image edge to edge. On the LEFT, a child sits calmly cross-legged, carried along a ' +
    'single long smooth flowing curved line like a gentle river that loops serenely ' +
    'around them — absorbed, settled, at peace. On the RIGHT, the same child sits tensely ' +
    'amid jagged radiating spark-lines and lightning-like zigzags, a blank-faced ' +
    'slot-machine reel spinning beside them — restless, jittery, wired. The two halves ' +
    'meet at the center. The jagged spark-lines on the right are the single crimson-red ' +
    'spot-color accent. ' + STYLE,

  // Blog cover: co-play. Adult and child together; the shared activity blossoms
  // into shared wonder. Warm, tender. Full-bleed.
  'the-case-for-co-play':
    'An adult and a child sit close together shoulder to shoulder on a cozy couch in the ' +
    'lower half of the frame, sharing one game controller between them. The cord from the ' +
    'controller rises and blossoms into a wide constellation of stars and small ' +
    'play-icons — a kite, a building block, a little rocket — spreading across the whole ' +
    'upper half and reaching the top corners. A single thread linking their two hands on ' +
    'the controller is the crimson-red spot-color accent. Warm, tender, connected. ' +
    STYLE,

  // Blog cover: open-ended vs guided play. Building freely vs running a single
  // fixed track. Full-bleed split scene.
  'sandbox-vs-on-rails':
    'The frame split into two halves that fill it edge to edge. On the LEFT, under a wide ' +
    'open sky, a child happily builds a sprawling irregular open structure out of loose ' +
    'blocks of every shape — free, expansive, branching outward to the corner. On the ' +
    'RIGHT, the same child stands on a single narrow straight track pinched between two ' +
    'fixed parallel rails running to one small distant doorway — orderly, channeled, one ' +
    'path only. A single block in the building child\'s hand is the crimson-red ' +
    'spot-color accent. ' + STYLE,

  // Blog cover: engagement vs addiction. A balance scale weighing a calm hand
  // against a grasping one. Measured, thoughtful. Full-bleed.
  'engagement-vs-addiction':
    'A large old-fashioned balance scale fills the frame, seen straight on. On the LEFT ' +
    'pan a single game controller rests calmly in an open upturned hand, settled and at ' +
    'ease. On the RIGHT pan a hand grasps and reaches greedily for a controller that ' +
    'radiates eager glow-lines, straining. Behind the scale, faint engraved measuring ' +
    'marks reach the edges. The scale\'s central pivot and balance-needle are the single ' +
    'crimson-red spot-color accent, tilting slightly. Thoughtful, weighing two states. ' +
    STYLE,

  // Blog cover: dark patterns. A friendly mascot whose cast shadow is a tangle
  // of hooks — the manipulation made visible. Knowing, not frightening.
  'dark-patterns-in-kids-games':
    'A cheerful rounded cartoon game mascot — a friendly blocky little creature with a ' +
    'big smile — stands in bright innocent light in the lower center. Cast large on the ' +
    'wall behind it, its shadow is not its own shape at all but a tangle of fishing ' +
    'hooks, looping lines, a slot-machine pull-lever and grasping tendrils, spreading ' +
    'across the whole upper frame to every edge. The friendly figure is oblivious; the ' +
    'shadow tells the truth. A single hook in the shadow is the crimson-red spot-color ' +
    'accent. Knowing, a little wry, not frightening. ' + STYLE,

  // Blog cover: the attention economy. A small child at the center of a vast
  // inward-spiralling funnel of feeds and notifications. Awe of scale.
  'the-attention-economy-and-kids':
    'A small child sits at the very center, dwarfed, holding a glowing screen. Around and ' +
    'above them a vast funnel-shaped vortex spirals inward toward the screen, built from ' +
    'long blank smooth scrolling ribbons and streamers (completely plain, no writing on ' +
    'them), bell-shaped notification icons and looping curved arrows, all swirling down ' +
    'into the device and filling the entire frame to the corners. One single bell-shaped ' +
    'notification icon in the spiral is the crimson-red spot-color accent. Awe-inspiring ' +
    'scale, the child small against the machine. ' + STYLE,

  // Blog cover (v2): violent content ≠ real harm. An oblivious child plays with
  // a blocky toy "weapon"; the cast shadow is gentle ordinary play, not menace.
  // The disconnect IS the research finding. Full-bleed, balanced weight.
  'does-violent-content-predict-harm-v2':
    'A cheerful child stands in the lower center in bright innocent light, mid-play, ' +
    'holding up a chunky blocky cartoon toy — a pixel-style toy sword and a little ' +
    'toy blaster — grinning, clearly just pretending. Cast large on the wall behind ' +
    'them, the shadow is NOT menacing at all: it is simply an ordinary child at happy ' +
    'play — jumping with arms thrown wide, a small kite and a few stars in the shadow ' +
    'around them. The fearsome-looking toy and the gentle, harmless shadow plainly do ' +
    'not match — that contradiction is the whole point. The scene fills the frame edge ' +
    'to edge, the shadow spreading to the top corners. The blocky toy in the child\'s ' +
    'hands is the single crimson-red spot-color accent. Reassuring, a little wry, ' +
    'gaming-positive. ' + STYLE,

  // Blog cover (retired): balance scale, controller vs blank research. Replaced
  // by -v2 — read as "games vs reading", off-topic for this post.
  'does-violent-content-predict-harm':
    'A large balance scale fills the frame, seen straight on, its beam perfectly ' +
    'horizontal and level in even equilibrium. On the LEFT pan sits a single game ' +
    'controller; on the RIGHT pan a tall stack of plain loose paper sheets and closed ' +
    'books with completely smooth blank spines and covers — absolutely no titles, no ' +
    'writing anywhere. The two pans hang at exactly the same height, the contest ' +
    'unresolved. Behind, faint engraved hatching like rows of shelves reaching the edges. ' +
    'The scale\'s central pivot and upright post are the single crimson-red spot-color ' +
    'accent. Measured, scholarly, even-handed. ' + STYLE,
}

type SAKey = { client_email: string; private_key: string }

async function getAccessToken(): Promise<string> {
  const keyJson = process.env.GOOGLE_CREDENTIALS_JSON
  if (!keyJson) throw new Error('GOOGLE_CREDENTIALS_JSON not set')
  const key: SAKey = JSON.parse(keyJson)
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  })).toString('base64url')
  const unsigned = `${header}.${payload}`
  const sign = createSign('RSA-SHA256'); sign.update(unsigned)
  const jwt = `${unsigned}.${sign.sign(key.private_key, 'base64url')}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`token exchange failed: ${await res.text()}`)
  return (await res.json()).access_token
}

async function main() {
  const [key, aspect = '4:3', countStr = '2'] = process.argv.slice(2)
  const prompt = PROMPTS[key]
  if (!prompt) throw new Error(`unknown key "${key}" — have: ${Object.keys(PROMPTS).join(', ')}`)
  const count = parseInt(countStr, 10)

  const token = await getAccessToken()
  console.log(`Generating ${count}× "${key}" @ ${aspect} …`)
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: count,
        aspectRatio: aspect,
        negativePrompt: NEGATIVE,
        addWatermark: false,
        personGeneration: 'allow_all',
      },
    }),
  })
  if (!res.ok) throw new Error(`Imagen ${res.status}: ${(await res.text()).slice(0, 500)}`)
  const data = await res.json()
  const preds = data.predictions ?? []
  if (preds.length === 0) throw new Error(`no predictions: ${JSON.stringify(data).slice(0, 400)}`)

  mkdirSync(resolve(process.cwd(), '.tmp/gen'), { recursive: true })
  preds.forEach((p: { bytesBase64Encoded?: string }, i: number) => {
    if (!p.bytesBase64Encoded) return
    const out = resolve(process.cwd(), `.tmp/gen/${key}-${i + 1}.png`)
    writeFileSync(out, Buffer.from(p.bytesBase64Encoded, 'base64'))
    console.log(`  wrote ${out}`)
  })
}

main().catch((e) => { console.error(e); process.exit(1) })
