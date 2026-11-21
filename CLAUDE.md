# Granny x DBD — project notes for Claude

A standalone fan game: Granny as the killer in a Dead by Daylight–style 1v4. It was forked from
**Nightbound** (froodyofficial-maker/Nightbound, a separate game) and cut down to its own identity.
three.js r160, plain ES modules in `public/js/`, bundled with esbuild into single HTML files.

## Hard rules from the owner (froodyofficial-maker)
- **The code lives in the repo froodyofficial-maker/Granny-X-DBD** (public, by the owner's choice).
  Don't turn on GitHub Pages or upload it anywhere else unless the owner asks. Hand builds to the
  owner directly as files (the .exe zip, the .apk, videos). Built files (GrannyDBD.html, exe, apk)
  are not committed: rebuild them with the commands below.
- **Killers: Granny, Grandpa (his own killer since 1.1, no longer an outfit), Slendrina, Angeline (1.3), Nosferatu (1.4.3) and Slendrina's Father (`father`, 1.5.0, playable from Season 2 = 1 Dec 2026).**
- **Survivors: only Mara, Eli, June and Tomás.**
- **Maps: Granny's House (`granny`), Granny's Old House (`granny1`), Slendrina: The Forest (`forest`, 1.4.3, at the
  owner's request, from the owner's copy of the game) and Midnight City (`city`, 1.5.0, City Mode only).** No other maps unless the owner asks.
- Removed for good (don't bring back): ghost traps, all lore, Testing Area, the old intro banner / trailer gate.
  (Sidekicks, the Progress screen, ranks and levelling were removed in 1.0 but the owner asked for them back in 1.4:
  they are in again, in the 1.4 form described below.)
- Bots must never stall. **Falling off the roof of the house is fine: don't add barriers.**
- Don't put the owner's real photo/face on any model.
- Never paste API keys or secrets into chat.

## Layout
- `public/index.html`, `public/css/style.css`, `public/js/*.js` — the game source.
  - `main.js` menus, sessions (HostSession / ClientSession), lobby, store, settings.
  - `sim.js` host-authoritative simulation; `bots.js` bot AI; `rules.js`, `movement.js`.
  - `map.js` + `grannyhouse.js` / `grannygrid.js` the house map (multi-floor levels + stairs, `heightAt`, `levelOf`).
    `buildMap(seed, map)`: `granny1` = Granny's Old House: `buildArena` (5x5 woods cells, ring pushed out by
    `HOUSE1.xs/zs`) with the Granny 1 house (`granny1_map.glb`, converted from the owner's USDZ, underground
    parts dropped). Since 1.2 its ground floor (hall, kitchen, living room, ~150 m2) is walkable through the front
    door (door + locks removed from the model and collision); the rest of the plot stays solid. Collision is
    `granny1grid.js` (measured from the model, no wall thickening so inside doorways stay open; navR 0.24 on this
    map). One generator is placed inside at build time by `placeHouseGen` (deepest spot reachable from the door).
  - `game.js` rendering/input/HUD per frame; `models.js` + `*Glb.js` character models; `world.js` scene.
  - `net.js` online (MQTT relay + self-signalled WebRTC), `snap.js` snapshots, `friends.js`, `awards.js`.
  - `loadscreen.js` the 3D loading screen (1.3: a killer reel in front of Granny's House: each killer steps out
    under a swinging bulb for 5.6 s with a name + powers card; soft light cone, dust, fog; `window.__lsSeek(t)` for shots).
    `showLoading(on, msg, isLite, rendererOf)`; it renders with the game's own renderer; the main loop
    skips the menu/game while it's up; `HostSession.start` is async with a frame yield between steps
    (this fixed the STATUS_ACCESS_VIOLATION freeze when loading into a match).
  - `progress.js` (1.4) account level, ranks (Ash..Iridescent, IV..I, 4 pips per grade), seasons (`seasonAt`: a new one every
    42 days from 1 Nov 2026, `SEASON` = the current one, 30 tiers x 1000 XP, free + premium track; premium costs
    `PASS_PRICE` 8000 Embers once per season; premium tier 15 = Angeline 'gilded' outfit, 30 = Granny 'longnight'
    (skins with `pass: true, price: -1`, owned only through the pass), every 5th premium tier a level token), `seasonRoll`
    (new season: Embers for each rank, ranks drop one tier, fresh pass; called at startup), character levels (`charLv`,
    `charOf` = `profile.chars[id] = { xp, st }`, `freePoints`, `matchStats`, `trainOne`), `applyMatch` (account XP, season XP,
    rank pips, and the played character's XP). Progress panel = `renderPass()` in main.js (menu button "Progress").
  - `touch.js` phone/tablet controls (joystick left, drag-to-look right, context buttons), `body.touch` CSS.
    Mobile mode (`MOBILE` = touch device or `window.__forceTouch`; `html.mobile`): no keyboard/mouse hint anywhere.
    `touchName(id)` maps keybind ids / 'LMB' / 'RMB' / 'V' to button names (game.js `KL()` / `B()` / `kbd()`),
    `mobileText()` rewrites "Hold G" / "Press R" / "click" in descriptions and feed lines; `.pc-only` is hidden,
    `.touch-word` only shows on mobile; the skill check dial is tappable and VAULT reads HIT! during one.
- `public/models/*.glb` (granny, grandpa, granny_anims, granny_map, granny1_map, slendrina, angeline, granny_bear_trap, spidermom, …), `public/img`, `public/fonts`.
- `tools/build.mjs` → builds **`GrannyDBD.html`** (offline single file, GLBs embedded) and **`index.html`** (web).
- `tools/electron/` Windows app (Electron 33.2.1). `tools/android/` APK build (no Gradle).
- `tools/test/` the headless checks used during development (Playwright + SwiftShader; `ROOT` is /home/user/granny-x-dbd):
  `simtest.mjs <map> <killer> <matches> <minutes>` bot-only matches, prints stall seconds (must be 0);
  `play.mjs <role> <killer> <map> <prefix>` plays a bot match and saves frames; `look.mjs <killer> <map> <prefix>` in-match shots;
  `lsshot.mjs out.png medium [menu.png]` loading screen (uses `window.__lsSeek`); `mobile.mjs` phone-emulated menu/help/HUD
  check (prints any key names left in the HUD); `lobbytest.mjs` 3 players vs a local relay (`node broker.mjs` first:
  aedes@0.51.3 + aedes-server-factory@0.2.1) for public/private lobbies; `angview.mjs` / `rigview.mjs` character poses;
  `rawglb.mjs file.glb prefix` plays a GLB's own clips with plain three.js; `render-devlog.mjs` + `devlog13-page.js` /
  `devlog14-page.js` / `devlog143-page.js` / `devlog152-page.js` the devlog banners (Vice Nights: `gjheader152-page.js` = Game Jolt header 3000x600, Game Jolt thumbnail = `lsart-page.js` frame 4 (LIST=4), shared art in `vicity-common.js`, served as `__vicity-common.js`) (in-engine, 2560x1440); `ui14.mjs` Loadout/Store/Progress screenshots;
  `match14.mjs` a 2v8 match as Angeline with the Child (`GM=classic K=granny` to change). simtest takes `MODE=duo` and
  `KID=1`. `offline141.mjs` runs the offline single file (Store picture, Profile panel, save mirror with a fake disk;
  `MOBILE=1` for phone size); `offkid.mjs` checks the Child loads in a match in the offline file. Playwright resolves through `tools/test/node_modules` -> `$(npm root -g)` (a symlink, not committed: recreate it).
- `server.js` optional LAN server (`node server.js 8090`), `start-*.bat/.sh/.command` launchers.
- `README.md` is still Nightbound's old README (outdated; don't trust it for this game).

## Identity / namespacing (keep separate from Nightbound)
- localStorage prefix `gdbd_` (e.g. `gdbd_settings`, `gdbd_profile`).
- Relay topics `grannydbd/v1/...`, PeerJS prefix `grannydbd-v1-`. `NET_PROTOCOL = 18`, `VERSION = '1.6.0'` (config.js).
- Public lobbies (1.3): the host publishes a retained message on `grannydbd/v1/pub/<4-char stem>` (`H.advertise(info|null)`
  in net.js, refreshed on every lobby change and each 60 s) with an MQTT last will that clears it if the host drops.
  `watchLobbies(cb)` subscribes `grannydbd/v1/pub/+` on every broker; main.js renders the list + Quick Join.
  Visibility is `lobby.vis` ('public'/'private', host toggle in the lobby). Relay-mode (node server.js) rooms are code-only.
- Official Discord: https://discord.gg/WXvAJ2sgVP (`DISCORD` in config.js): menu top-right button and pause menu.
- Electron appId `io.github.froodyofficial.grannyxdbd`. The APK signing keystore (`release.jks`,
  alias `grannyxdbd`) is NOT in the repo: the owner keeps it. Put it in `tools/android/` and set
  `KS_PASS` before building; always sign with the same key so updates install over old versions.

## Gameplay details worth knowing
- Difficulty (`config.js` DIFFICULTY): easy {aim .3, killerSpeed .84, sight 18, reach 2.1},
  normal {react .55, aim .42, killerSpeed .87, sight 22, reach 2.2}, hard unchanged.
- Bot survivors use `SURV_SKILL = { react: .35, skill: .94, great: .2 }` (bots.js).
- Bots: `regions()/regionAt()/nearestIn()` reachability (grid type 1 = blocked, gates passable);
  `goTo` falls back to a direct move when there's no path; flee only to reachable spots, on the
  right floor. Bat Rush gated by `willing(b, D, dt)`; I Hear You rates scaled by difficulty aim.
- Skins: price-0 skins count as owned. `window.__THREE`, `window.__killerSkin`, `window.__cine`
  (film-camera hook called in game.js after updateCamera) exist for trailer capture.
- `game.touch` bypasses pointer lock (touch devices).
- Grandpa (`grandpa`): shotgun (RMB hold/release, act `rush` -> `sim.shotgun`, survivors' `shp` bar: 34 dmg at <=2m
  to 75 at >=14m, so 2 shots down from mid range, 3 point-blank; each hit staggers (boost 0.9s at x0.6 speed)), Bear Trap (R, `S.bears`, `snare`). Model = grandpa.glb via `makeGrannyGlb({grandpa:true})`; his body/gun
  materials are brightened in `AnimRig.material` (the file darkens them to 30%).
- Slendrina (`slendrina`, third person): Haunt (RMB hold shows a ground marker, act `haunt` with x/z ->
  `reachableSpot`, `tele.h`), Cursed Gaze (R, `gaze` timer; survivors looking at her get `cursed`/`curse`,
  `doomed` = next hit downs). Model slendrina.glb (DVUnit, spec-gloss converted to metal-rough).
- Bot watchdogs (bots.js): a survivor still for 2.5s avoids that goal 15s (`b.avoid`), a killer still for 3s
  drops its target/patrol and avoids unreachable hooks/downed (`b.kAvoid`). Carrying killers path round
  dropped pallets; killers avoid one-cell gaps (`grid.narrow`).
- Smarter bots (1.2): survivors treat Grandpa aiming at them (32m, in sight) as a threat and zig-zag (`b.juke`),
  flee Slendrina's gaze and her haunt arrivals, remember ~60% of the traps they see (`b.traps`), and break sideways
  when cornered (`b.cornerT`). Killers weight targets (snared, doomed, heard, low shp); Grandpa strafes at mid range
  while the gun cycles.
- Angeline (`angeline`, third person, 1.3): Yellow Eyes (RMB hold: a 16 m beam from her eyes; 0.5 s in it = `spotted`,
  her next hit downs; `spotT`/`inBeam`), Lullaby (R: survivors within 30 m get `drowsy` 5 s: no running, x0.75 speed).
  Model angeline.glb (CC BY 4.0, "Angeline Unity" by A_Forogotten_Studio; SPEC yaw PI). Her camera sits wider and she fades
  when a wall pulls the camera close. **She is animated in code, not with the file's clips** (they twisted her and stretched
  her arm; the rest pose stood her sleeves up like wings). The file's bind matrices are ~1.8x taller than the mesh:
  `toBindPose` fits that stretch from the mesh's joints, corrects the inverse bind matrices and puts her in the T-pose;
  `animateAngeline` aims bones in parent space (`aimBone`/`turnBone`) from that rest each frame (hanging arms, glide lean,
  float bob, spread arms for Yellow Eyes, wind-up + two-handed lunge, stun flail). Her size is measured in that pose.
- Granny's House floors (1.3): `grannyfloors.js` = per-floor support maps measured from granny_map.glb; nav cells with no
  floor under them are blocked, and `dropFloor` drops anyone who walks off an edge to the floor below. Gen/teammate
  auras are hidden across floors. Bear traps use granny_bear_trap.glb (jaws close on `bearsnap`).
- Character levels and stats (1.4, `CHAR_LEVEL` / `STATS` / `cleanStats` / `statK` in config.js): every character has its own
  level (max 41, XP from matches or `train` with Embers, or a level token from the pass); each level past 1 is a stat point,
  max 10 per stat. Survivor: Agility (+0.8% speed/pt), Mechanic (+2.5% repair and gates), Medic (+3% healing), Grit (+5%
  struggle and unhook). Killer: Stalker (+0.6% speed), Focus (+2.5% faster recharge: the sim shortens any cooldown that was
  just started, `cdPrev`), Brutality (+4% break/kick/pickup/hook), Reach (+1.5% lunge). Players carry `stats` (STATIC in
  snap.js); hooks are in rules.js `speedOf` / `actionTime`, sim.js gen repair, healing and wiggle. Bots have none.
  Loadout shows level, XP bar, points (+/−, reset free), Train and level tokens (`levelHTML` / `bindLevel`).
- Sidekick (1.4): `SIDEKICKS.child` "The Child of Slendrina", killers only, 20,000 Embers in Store > Sidekicks, equipped
  in the killer Loadout (`profile.pets.child`, `profile.killer.pet === 'child'`, sent as `kid: 'child'`). Sim `updateKids`:
  `S.kids` [{id = owner, x, z, fl, sp, yaw, st 0 idle / 1 crawl / 2 shriek, tp}], crawls behind-left of its killer
  (out of the camera's way), catches up out of sight on another floor / far / stuck; a survivor within 11 m in its sight
  -> shriek: revealed 4 s (14 s per survivor), event `kidcry`. Model slendrina_child.glb ("DVloper - Slendrina's Child
  (Official Model)" by danielthesecond, CC BY 4.0; own clips idle/walk/attack/eat...), `makeChild` in grannyGlb.js; game.js
  `updateKids` draws it and fades it near the camera. Bot killers bring it 35% of the time. Portrait: public/img/child.png
  (tools/test/childshot.mjs, then convert to public/img/child.jpg).
- Two Killers / 2 vs 8 (1.4): `MODES.duo` (killers 2, survivors 8, 6 of 7 generators). Bot killers stop patrolling generators
  once the gates are powered and pace in front of their own gate (`killersOf(S).filter(bot).indexOf(p)`).
- Third-person camera (1.4): besides the collision boxes it ray-casts the house model (`W.glb`, ~15/s) and a point 0.7 m
  lower, so it no longer ends up inside walls/the broken gate that have no collision box.
- HUD perks: four perk diamonds sit top/left/right/bottom (`#perks .diamond:nth-child(4)`).
- Saves (1.4.1): `store` in main.js writes localStorage AND a disk copy when there is one: the Windows app's
  `tools/electron/preload.js` (`window.gdbdDisk`, sync IPC to main.js -> `%APPDATA%\Granny x DBD\saves\profile.json` /
  `settings.json`, written atomically) and the Android app's `GameStore` (JavascriptInterface, SharedPreferences
  `gdbd_saves`). Every profile save bumps `profile._sv`; on load the copy with the higher `_sv` wins, so a cleared or
  replaced browser storage comes back from disk. Uninstalling the APK still deletes everything: that's what the backup code is for.
- Profile panel (1.4.1, click the name top right, `renderProfile`): name (= settings.name), avatar (`profile.avatar`, one of the
  8 characters), title (`profile.title`, `titlesList()`: level, ranks, achievements, badges), name colour (`profile.accent`),
  character levels, and a backup code (`GDBD1:` + base64 of {n: name, p: profile}; Copy / Show / Restore from a code).
- Images used by the offline builds must come through the stylesheet (`url(../img/...)` is inlined by build.mjs): a
  plain `<img src="img/...">` works on the web build only. The Child's picture is `.child-art` (public/img/child.jpg).
- Headless bot-only matches (Sim + Bots, no rendering) run ~10 game minutes per second: useful to find stalls.

## Build
```bash
cd tools && npm install && cd ..
node tools/build.mjs            # → GrannyDBD.html + index.html
```
Play/test: `python3 -m http.server 8091` in the project root, open `http://localhost:8091/index.html`.

### Windows .exe (Electron)
```bash
cp GrannyDBD.html tools/electron/app/index.html
cd tools/electron && npm install
npx @electron/packager . GrannyxDBD --platform=win32 --arch=x64 --out=out --overwrite --icon=icon.ico
(cd out && zip -qr ../GrannyxDBD-Windows.zip GrannyxDBD-win32-x64)   # backup: the folder, must be extracted
npx electron-builder --win portable --x64 --prepackaged out/GrannyxDBD-win32-x64 --config builder.json -c.portable.unpackDirName=GrannyxDBD-<version>  # → dist/GrannyxDBD.exe
```
The single portable `dist/GrannyxDBD.exe` (with `splash.bmp`) is what the owner uploads: people ran the old .exe
from inside the zip. Without Wine, `--icon` can't be applied by the packager: set icon + version on the packaged exe
before the electron-builder step: `node tools/electron/seticon.mjs out/GrannyxDBD-win32-x64/GrannyxDBD.exe icon.ico 1.3.1`
(resedit + pe-library). The NSIS installer target needs Wine. In practice: package with `--ignore='^/out' --ignore='^/dist'`
(no `--icon`), run seticon, then electron-builder. The owner can't download a bare .exe from the chat: send it zipped
(`zip -9 GrannyxDBD-<ver>-Windows.zip GrannyxDBD.exe`).

Since 1.4.2 each version unpacks to its own temp folder (`-c.portable.unpackDirName=GrannyxDBD-<version>`), and main.js passes
its version with the single-instance lock: an OLDER copy still running closes itself when a different version starts (the
new one retries the lock for ~8 s). Before, a still-open old copy was just brought to the front ("it's like the old version").
`main.js` opens `app/index.html`, maximised, no menu bar, F11/Alt+Enter fullscreen, single instance, logs to
`%APPDATA%\Granny x DBD\log.txt`; repeated GPU/page crashes relaunch it in Safe Graphics mode (software WebGL,
sticky; `--gpu` resets it). External links go to the real browser.

### Android .apk
Uses an Android SDK at `SDK=/home/user/android-sdk` (build-tools 34, platform 34) if present; otherwise Ubuntu's packaged
tools (`apt install aapt dalvik-exchange zipalign apksigner android-sdk-platform-23`: aapt2 + dx + android-23.jar, with
compile-only stubs in `tools/android/stubs/`). dl.google.com is blocked in the cloud sessions, so the apt route is the one
that works there. `KS=/path/to/release.jks` picks the keystore.
```bash
tools/android/build-apk.sh /path/to/GrannyDBD.html     # → tools/android/GrannyxDBD.apk
```
It sets the page viewport to 1280 CSS px (menus fit phones), forces mobile mode (`__forceTouch` + `html.mobile`), compiles `src/` (MainActivity.java,
GameClient.java — a WebView; javac -source 8 against android.jar; d8; zipalign; apksigner).
Bump `VC`/`VN` env vars for a new version.

## Testing in a headless browser (what worked)
- Playwright + Chromium with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.
- Seed localStorage (`gdbd_settings`, `gdbd_profile` with `seen` flags) in an init script.
- `window.__nbMqtt = ['ws://localhost:8883']` points online play at a local MQTT-over-WebSocket broker
  (e.g. aedes + aedes-server-factory) for multiplayer tests; `window.__nbNoRTC = true` forces relay-only.
- `window.__nb` exposes `session`, `lobby`, `settings`, `profile`.
- Software rendering is slow: grab frames with `renderer.domElement.toDataURL()` right after
  `game.frame()` instead of page screenshots at high quality.

## Done so far (history)
Granny-only roster and house map; Grandpa outfit; 3D loading screen; load freeze fix; Electron app;
APK with touch controls; smarter bots (no stalls); Game Jolt header/thumbnail/page text using the
owner's GRANNY and DBD logos (no line under them); a 57 s YouTube trailer (v2: tense synthesized
score, re-shot scenes) and a 17 s vertical YouTube Short with a "SHE HEARD YOU." thumbnail.
1.3: Angeline, real Granny bear trap model, Granny's House floating-floor fixes, killer-reel loading screen, sharper
graphics (anisotropy, PCF soft shadows on medium, unsharp mask in PostShader), public/private lobbies + lobby browser,
Discord link, mobile-only controls + APK 1.3.0 (versionCode 13). The 1.3.0 APK was signed with a NEW key (the owner's
release.jks wasn't available), so players uninstall older APKs first; re-sign with release.jks for later updates.
Devlog banner "ANGELINE · SLENDRINA'S MOTHER IS HERE" rendered in-engine.
1.6.0 (current; APK versionCode 28, Windows 1.6.0, NET_PROTOCOL 18): the graphics update + the owner's suggestion list.
- Performance/look: no film grain, GTAO only if `settings.ao`, MSAA render target per quality (`QUALITY[q].msaa`), dynamic resolution only
  below 40 fps; light pool (world.js `poolLights` / `updateLightPool`: only 2/4/6 real PointLights follow the nearest lamps); grass in 4x4
  chunked InstancedMeshes; shadows max 2048; offline builds embed the KTX2 photo scans (`#nb-tex`, pbr.js `texManager`); Safe Graphics mode
  in the exe expires per version (`gdbd-gpu` IPC turns it off). Lamps = cast-iron lanterns; `makeGenerator()` in models.js.
- bloodfx.js: `fixModelBlood` (Granny's bat "Blood" shell = alpha-tested dark blood, no more white bat), `weaponBlood` smear. matfx.js
  `enhanceCharacter` (relief/roughness maps from the colour texture; Angeline).
- GTA VI theme as an owned item (`themes.vi`, 20,000, in the pass), per-character GTA loading art (img/ls/*.jpg, `setLoadingCast`), menu
  music public/audio/vitheme.mp3 (owner's file: Justice - Flower In A Hurricane, from GTA VI) played from 0:50 with a 5 s fade
  (`sound.menuMusic(on, 'vitheme')`, Settings toggle `settings.viMusic`), embedded as `#nb-vitheme-mp3`.
- UI/Store revamp (glass panels), `levelEmblem` (icons.js; max level = gold wings + crown).
- **Tamed Crow** (`SIDEKICKS.crow`, 15,000, survivors; `profile.pets.crow`, `profile.survivor.pet === 'crow'`, roster `kid: 'crow'`): sim
  `updateCrows` (crowCd 50-80 s, flies `crowF` 3.4 s if a killer is within 45 m, at the top `crowSee` 5 s = the killer's outline for its
  owner, events crowfly / crowcaw; bots get the spot as `intel`). crow.js: public/models/crow.glb ("Granny granny 3 crow dvloper" by
  Gsjeijenjd, CC BY 4.0, owner's upload, texture repacked as JPEG) = static mesh rigged in code (SkinnedMesh, head/tail bones; flight
  feathers drawn in code open on the wing bones). game.js `updateCrows` perches it on `R.j.shL`. Store art img/crow.jpg (crowshot-page.js).
  Bots bring one 20% of the time.
- **Sawed-Off** (Grandpa perk `sawedoff`): once the gates are powered he saws for 2 s (`sawT`), then `sawed`: `SAWED` shotgun stats in sim.js
  (two quick shots, 12 m, more damage up close), +6% speed (rules.js). `sawOffGun(root)` (grannyGlb.js) shortens the barrel mesh
  (ShotgunPipaGP, the end away from his right hand). Bot killers now roll character-only perks too (`randomPerks(..., c)`).
- Taser add-ons: `cellswap` Battery Replacement (HUD cells `#tcells`, R / phone BATTERY button at a chest with a flashlight = act `batts`,
  `RULES.battTime` 3 s, needs `p.battKey` from the 'in' message `b`), `probes` (+25% range), `trigger` (cooldown x0.55). `p.taserMax`.
- Per-character perks (`profile.perkSets[char]`, pin button over the slots), hold +/- on stat points, separate survivor bot difficulty
  (`botsCfg.sdiff` -> Sim `survDifficulty` -> bots.js `SURV_SKILLS`). Grandpa pumps the shotgun with his left hand (`grandpaPump`, 2-bone IK).
- Freddy is still missing (freddy.glb not in the repo or the uploads): ask the owner for the file.
- Tests: crowlook.mjs (crow in a match + taser cells), simtest `CROW=1` / `KPERKS=sawedoff`, pump-page.js (Grandpa's pump + sawed-off gun),
  gfx160.mjs, offtex.mjs.

1.5.3 ( APK versionCode 27, Windows 1.5.3, NET_PROTOCOL 17):
- **Everything GTA VI ends 1 Dec 2026** (`VI.until` = Date.UTC(2026, 11, 1), owner's request): theme, Vice Nights card, the item, the pass and the
  two GTA VI collectables' spawning (`COLLECTABLES[].until`). Earned badges and found collectables stay on profiles.
- The VI badge is the official GTA VI logo (owner's choice): `viBadge(size)` = a `<span class="vi-badge">` with public/img/gta6.png through
  the stylesheet (inlined in the offline builds). vice.js `gtaLogo()` reads that same CSS url to paint the in-game monitor.
- **GTA VI (PlayStation)** (`ITEMS.gtaps`, 7,500 Embers in Store > Add-ons, `profile.gtaps`, Loadout item 'gtaps'; `ownsPS()` = owned AND
  `viOpen()`): RMB throws the game case (vicesim.js `viceAct`, `S.cases`, arc, 20 m); a killer hit is stunned 5 s with `K.gamed` and is drawn
  sitting at a desk (vice.js `makeGameDesk`: table with panels to the floor that hide the legs, monitor with the GTA VI logo, console, gaming
  chair; root lowered `SEAT_DROP` 0.4; first-person camera lowered too). 3 throws a match. Bots carry it 15% of the time during the event.
  Model public/models/phone_case.glb (the owner's upload, really a GTA VI PS5 case; cover faces -x). Store art public/img/gtaps.png
  (tools/test/propshot.mjs renders a GLB to a transparent PNG).
- **GTA VI Pass** (`VI.passPrice` 50,000 Embers, Vice Nights panel + Store > Add-ons, `profile.vi.pass`): gives the item, the VI badge (+ Vice
  Legend title) and both GTA VI collectables at once.
- **Collectables** (`COLLECTABLES` in config.js, each with a chance 10-70%): monster (GTA VI Monster Can, monster_can.glb, 10%), gtacase
  (phone_case.glb, 18%), goldted (teddy.glb tinted gold), page / key / bulb (made in code). vicesim.js `viceInit` places the ones that roll on
  a random reachable spot (`S.colls`); first player within 1 m gets it (event 'coll' -> game.js dispatches `gdbd-coll` -> main.js `addColl`).
  collect.js: `profile.colls {id: {n, at}}`, `profile.showcase` (max 3, ★ on the shelf), Profile panel shelf + showcase, thumbnails rendered
  once with a throwaway renderer (`makeThumbs`), 3D viewer modal (`openCollView` -> vice.js `openViewer`, its own renderer, drag to turn).
- **Leaderboard** (trophy button `#lb-btn` top right, panel `p-lb`): every player's entry is a retained MQTT message on
  `grannydbd/v1/lb/<profile.fid>` on every relay (net.js `publishBoard` / `watchBoard`), sent at startup and after each match; tabs
  Collectables / Kills / Escapes / Level. Settings toggle `settings.lb` (off clears the entry). Classes are `ldb-*` (`.lb-*` = lobby browser).
- Granny's House music: public/audio/granny3.mp3 (owner's "Background Noise Inside"), `sound.mapMusic(on)` while a match on map 'granny'
  runs (main.js 0.5 s interval; `session.map`, also set on ClientSession); offline builds embed it as `#nb-granny3-mp3`.
- Main-menu title = the real logos (owner: "use the official Granny and DBD font"): `h1.logo-imgs` with img/granny-logo.png × img/dbd-logo.png
  (the Dead by Daylight logo the owner sent, cut out of its checkerboard), no line under it.
- **GTA-style loading screen** while Vice Nights runs (`html.theme-vi`): loadscreen.js adds `#vl` to #loading and `#loading.vi-ls`; four comic
  illustrations (public/img/ls/{granny,grandpa,slendrina,nosferatu}.jpg, 1920x1080, tools/test/lsart-page.js: the killer rendered sharp
  on a transparent background with sunset rim light + ink outline over a painted backdrop drawn in 2D: sunset sky, sun, clouds, skyline, palms,
  gas station / pier / rooftop billboard; lsart.py only saves them; owner wanted GTA V's crisp illustrated look, not filtered screenshots) cross-fade with a gentle CSS drift, logos top-left, GTA VI logo top-right, GTA tips (`VI_TIPS`) + spinner at the bottom. All CSS (keeps
  moving while the match builds); the 3D reel isn't started under it (`shownAt` is still set, startup waits on it).
- Menu: Redeem Code left the main menu (Store tab "Redeem Code", gold); the Vice Nights sky is calmer (small sun high up, two small palms on
  the right, hidden while a panel is open) so it no longer covers the characters.
- Fixes: online players were turned into bots when their game was busy loading for 15 s (host `seen` timeout, now 45 s): their survivor was then
  driven by a bot and Take Over (T) did nothing for them. Pepper Spray / Taser / Teddy / GTA VI no longer draw a flashlight or beam (sim
  `flashOn` and game.js require item 'flashlight'); the HUD item card shows each item; the phone RMB button is SPRAY / TASER / TEDDY / THROW
  with its own icon (touch.js `ITEM_BTN`, `setTouchCtx(role, char, item)`).
- Freddy: freddy.glb is still missing here (Sketchfab Standard licence, kept out of the public repo): builds made in the cloud show him as Granny.
  Put the file in public/models/ before building.
- Tests: `vicelook.mjs` (desk, case, collectables in a match), `ui153.mjs` (menus with the date faked, buying the pass, after 1 Dec),
  `taketest.mjs` (take over in a bot match), `takeonline.mjs` (client takes over through a local relay), simtest `ITEM=gtaps`.
  Trailer: `trailer153-page.js` (FRAMES=480 OUTDIR=... render-devlog.mjs, 24 fps) + `trailer153-music.py` (synthesized synthwave);
  thumbnails `thumb153-page.js` (YouTube) and `devlog153-page.js`. render-devlog.mjs: FRAMES / FROM / LIST / OUTDIR for videos, serves
  tools/test files as `__name` (pngs too); the official logo cut-outs live in tools/test/art/ (gitignored).

1.5.2 (APK versionCode 26, Windows 1.5.2, NET_PROTOCOL 16):
- City Mode hiding spots: climbing out left the slats (`#hideov`) on the screen. The overlay was only switched inside
  `cityCamera`, which stops being called once you're out; now `hideOverlay()` runs at the top of `updateCamera` every frame.
  Test: tools/test/hidetest.mjs (hide in a dumpster, climb out, check the overlay).
- **Vice Nights** (limited event celebrating GTA VI, vi.js): `VI.from` 20 Nov 2026 .. `VI.until` 15 Dec 2026 (UTC). While open:
  `html.theme-vi` (neon sunset: `#vi-sky` glow/striped sun/perspective grid/palm silhouettes in the menu, pink accents via the
  CSS variables, neon logo, loading bar), Settings toggle `settings.viTheme` (row only shown during the event), main-menu card
  `#vi-card` -> panel `p-vi` (`renderViPanel`). The **VI badge** (`viBadge(size)`, our own SVG, no Rockstar art): `profile.vi =
  {esc, kills, got}`; `viRecord` in onMatchEnd counts escapes / kills inside the window, not on Easy (`sess.opts.difficulty`),
  goals `VI.goals` 25 escapes + 60 kills; `got` = timestamp, kept forever, can't be earned after `until`. Shown by the name in the
  top-right chip, in the Profile panel, as the title "Vice Legend", and in online lobbies (`hello.vi` -> lobby player `vi`).
  Inbox `gdbd152` (from 20 Nov). Test: tools/test/vitest.mjs (fakes the date: during / after, with / without the badge).
- freddy.glb isn't in the repo (gitignored): builds made without it show Freddy owners as plain Granny.

1.5.1 ( APK versionCode 25, Windows 1.5.1, NET_PROTOCOL 16): the community update (credited in How to Play + inbox:
Ommm = outlines, sound variety, backup file, Pepper Spray; WolfSpider = instant sacrifice, generator pistons/sparks).
- City Mode cars: `carBlocked(..., from)` = `carDepth` (penetration) may not grow, so a wedged car can always drive/back out (the
  "can't drive" reports: ped cars passed through parked ones and left them stuck forever); enter range 3.5 m from the centre;
  ped lanes 0.95 m off the centre line, kerb parking 2.5 m; ped cars ignore parked cars at the side (`ahead(.., 1.0)`).
  Tests: `cardrive.mjs` (host, real key presses), `citynet.mjs` (client B drives through a local relay: `node broker.mjs` first).
- Outlines (`auraMat` / `auraSkinMat` + `auraParts` in models.js): a stencil mask of the silhouette (opaque pass, renderOrder 9) +
  faint fill + a screen-space extruded outline drawn only outside the mask (`AURA_W`, pulse `AURA_T`). The composer's render
  target has `stencilBuffer: true`. game.js calls `auraParts` whenever it colours an aura.
- Pepper Spray (`ITEMS.pepper`, chests 20%, 3 sprays, 3.6 m cone): `K.peppered` 25 s: game.js `#pepperov` blur, no survivor auras
  for that killer, bot killers see 4 m and ignore reveals. Bot survivors spray when the killer is within 3.2 m.
- Sound: every `sound.play` gets its own pitch/volume (`vf`/`vv` in audio.js). Menu music: public/audio/menu.mp3 (owner's track,
  128 kbps), `sound.menuMusic(on)` (main.js toggles it every 0.5 s: on unless a match is being played); offline builds embed it
  as `#nb-music-mp3`.
- Backup file: main.js `autoBackup` (every profile save, max once a minute, once there's a match played): Windows app
  `gdbdDisk.backup` -> Documents\Granny x DBD\Granny x DBD backup.txt (`gdbd-backup` IPC; loaded by itself on a fresh start);
  Android `GameStore.writeBackup` -> MediaStore Download/Granny x DBD (API 29+), `pickBackup()` = SAF picker ->
  MainActivity.onActivityResult -> `window.__gdbdBackupFile`. Profile panel: Save backup file / Load backup file.
- Embers: `embersOf(p)` (rules.js) = score / 2 (survivor) or / 4.5 (killer), max `EMBER_CAP` 4000. Gift codes: the list shows all.
- Instant sacrifice: no survivor left with st 'ok' -> everyone on a hook dies at once (sim.update). Generators: pistons pump at
  3 + 15 x progress once there is any; regressing gens spark (game.js). Main menu season card (`renderSeasonCard`).
1.5.0 (current; APK versionCode 24, Windows 1.5.0; NET_PROTOCOL 15). The owner's requests: new skins, a proper place to
redeem codes, City Mode (a one-month event), loading stutter; then "Season 1 ends 1 Dec with City Mode as its headline, Season 2
comes by itself on 1 Dec" with Slendrina's Father, the Teddy, a main mode of my own design and Chaos Shuffle.
- Dates: `nowMs()` (config.js) = `window.__now` || Date.now() (tests fake the date with `window.__now`). `modeOpen(id)`: MODES with
  `from` / `until`. City Mode `until` 1 Dec 2026; pages + shuffle `from` 1 Dec 2026 `until` 12 Jan 2027. `KILLERS.father.from` 1 Dec
  (PLAY_K filters it out before then). progress.js: S1 = 1 Nov..1 Dec 2026 (30 days), S2 from 1 Dec, then every 42 days; `S_SKINS` =
  each season's premium outfits (S2: Slendrina 'snow' tier 15, Father 'frost' tier 30). INBOX entries with `from` show up then.
  Main menu: `#nav-event` (the newest open event mode, days left) opens Play as Survivor with that mode picked.
- **City Mode** (`MODES.city`, map: 'city'; resolveMap / lobby / bots force the map): citymap.js (no imports: CITY grid 7x7 blocks
  22 m apart, 15 m blocks, 7 m streets on `ROADS`, half 81; block templates + `extra`: `M.hides`, `M.carSpots` (kerbs + parking
  lots, >= 12), `M.pedNodes` (pavement corners graph), `M.cityLamps`, `M.cityCells`), built by map.js buildArena (CI = CITY: no
  jitter, gates at street ends). city.js (sim): `S.cars` [{id,x,z,y,v,d driver id,pd ped id,home,lane}], `S.peds` [{s 0 walk/1 flee/
  2 dead/3 driving, c car, n node, lk look}], players `hide` / `car` (-1). findInteraction (rules.js) wraps `baseInteraction` +
  `cityInteraction` (exitcar / unhide are exclusive; bots only hide/search the spot in `p.hg`, never drive). Acts hide/unhide/search/
  car/exitcar/carjack (CITY_TIMES) finish in `cityFinish`. The driver drives on their own machine (`driveCar`; game.js `this.drive`,
  pos message `cy`/`cv`, host allows 3+17/s): survivor car rams the killer = stun 2 s; killer car knocks a survivor aside; a killer
  strike on a car pulls the survivor out (`cityOnDamage`). Peds: killers' lunge kills (`cityKillerHit`), run-overs; Embers via
  `score.c`, capped 2400 per match (`CITY_PAY`). Cars push walkers (moveCircle `pushFromCars`) except bots (`noCars`: cars aren't on the
  walking grid). Abandoned cars off the streets are towed after 40 s. cityworld.js draws it (asphalt, pavements, markings, buildings
  `kind 'bldg'` with canvas facades + lit windows, neon, skyline, lamps in W.lamps, hides, cars = `makeVictimCar()` (grannyGlb;
  bonnet "Motorhuv" is -x in the file), peds = makeSurvivor with random colours); chase cam / hiding peek in game.js `cityCamera`.
  Bots: survivors `hideFrom` while fleeing, leave after the killer goes; killers `searchHides` near where they lost someone, `huntPed`.
- **Slendrina's Father** (`father`): public/models/slenderman.glb ("SlenderMan" by Voidircel, CC BY 4.0), a static mesh given a code
  rig in grannyGlb.js (`fatherGeo`: arm weights by distance along shoulder->hand; `FatherRig`, `animateFather`; tendrils = segment
  chains shown while aiming). Tendril Lash (hold RMB, release after `wind` -> `sim.fatherLash`, 8 m line), Faceless Step (R:
  survivor in his view cone up to 36 m, `p.tele.step`, appears behind them after 1 s, `updateFather`), Static (survivors facing him
  within 16 m build `sta`; 2.5 s = revealed; game.js `#staticov`). Outfits default / static (3500) / frost (S2 pass).
- **Teddy** (`ITEMS.teddy`, models/teddy.glb "Teddy" by iskaa!, CC BY 4.0; img/teddy.png): Store > Add-ons card, 6000 Embers,
  `profile.teddy = SEASON.id` (owned only that season), survivor Loadout "Item" row (`profile.survivor.item`), roster `item: 'teddy'`.
  Sim: act 'teddy' -> `tedT` 1.4 s raised; killers facing it (cone 0.62 rad, 24 m, in sight) are stunned 10 s, second use 5 s
  (`updateTeddy`, `teddy` = uses left). Bots bring one 20% of the time in S2 and hold it up when caught.
- **The Pages** (`MODES.pages`, S2 headline): generators are pages (game.js `updatePages` swaps the models for a page on a post),
  ~14 s solo each (`RULES.genCharges / 14`), all pages needed (max 8), no kicks, no skill checks; killer +4% speed per page and
  `silentT` 6 s (terror 0) after each; fog thickens. **Chaos Shuffle** (`MODES.shuffle`): every 50-80 s `sim.shuffle(K, V)` swaps
  everything about the bodies except id/name/bot/score (event 'shuffle'; bots get fresh brains).
- Outfits with their own models: only **Sigma Grandpa** (`grandpa_thug.glb`, weight-transferred onto Grandpa's rig by `reskin`).
  The four Granny ones made the same way (Bloody, Nightmare Mode, Santa, Witch) were removed again before 1.5.0 shipped: the owner
  said they didn't look good in game. Don't bring them back unless asked. Freddy (secret code outfit) stays.
- Loading: `waitForModels` waits only for the played map's scenery and the killers in the roster; `holdLoading(true)` (loadscreen.js)
  freezes the 3D reel on a still that CSS animates (compositor, so no stutter) while the match is built. Fixed: main.js used `skinOf`
  without importing it (every match start failed after the outfit commit).
- Tests: `citylook.mjs` (City Mode shots: street, peds, driving, hiding), `s2look.mjs` (date faked to 2 Dec: Pages + Father + Teddy),
  `offevent.mjs <gm> <killer> [date]` (offline single file: event button, match start, held loading), `glbview.mjs` (static GLB bounds
  + shots), simtest `MODE=city|pages|shuffle`. Devlog banner: devlog150-page.js ("CITY MODE · SHE CAME TO TOWN").
1.4.3 (APK versionCode 22 so it installs over every earlier APK, incl. the 1.3.3 one (21) built on the other branch;
NET_PROTOCOL 14: a new killer, so 1.4.2 and 1.4.3 don't share lobbies):
- **Nosferatu** (`nosferatu`, third person): model public/models/nosferatu.glb ("Nosferatu Trailer version/Slendrina The Forest" by
  Mr.Prizz, sketchfab.com/Rodolfoisreal1423, CC BY 4.0; credited in How to Play) with its own clips idle/Walk/attack/hurt; its
  painted ground-shadow mesh (material SlendrinaSkugga2) is hidden on load; SPEC h 1.98, yaw PI. `makeNosferatuGlb` /
  `animateNosferatu` (grannyGlb.js): crouch + lean while coiling (`s.aim`), attack clip scrubbed mid-leap (`s.leap`), whole
  attack clip on a strike, hurt when stunned. Powers reuse old Nightbound code: **Night Leap** (RMB) = Chucky's pounce
  (`'pounce'` act, `updateLeap`, abT coil 0.9 s, 3-11 m, cooldown 8); the landing spot is pulled back along the line to
  the farthest point `reachableSpot` (walkable + a path back to the take-off point), never off the edge of an upper floor
  (`floorUnder`), and `leapLanded` puts him back at the take-off point if he still came down somewhere sealed off.
  **Nightfall** (R) = like the Foreman's Lights Out: `p.ab = 1` for 8 s, `S.dark`, terror radius 0, +8% speed (rules.js),
  event `nightfall`. **Blood Scent**: injured survivors (hp 1) within 26 m revealed; every hit gives `haste` (feed).
  Bots: leap when in sight 3.4-10.5 m (`willing`), Nightfall in mid-range chases; survivor bots juke when he crouches.
  Outfits: The Count (default), Plague Ship 2500, Blood Moon 4000 (tints).
- Killer bot watchdog (bots.js): stuck twice in a row in a nav region not connected to the killer spawn's region (a gap
  between two walls of the house model it squeezed through, behind Granny's House at ~(23.5, 23)): it steps out to
  the nearest connected cell (`nearestIn`).
- Fixes carried over from the 1.3.x branch (`exe-launch-fix`, built in another session from 8963da3; its 1.3.2/1.3.3
  features — Freddy codes, profile cards, gifts, graveyard map, touch icons, optimization mode — are NOT in 1.4.x):
  the Windows exe launch fix (`executableName` in builder.json) + splash window, the loading-screen overlap / match-start
  freeze / context-loss / lobby-panel fixes (d842a09), and the 1.3.3 phone fixes (emotes, tap-anywhere skill checks with
  the `.tc-sc` prompt, USE latch, Settings > Edit touch controls) + Angeline's arms out of her dress.
- `HostSession.pump` returns until `sim` and `bots` exist: the background host pump (Worker timer) used to call step()
  during the async `start()` and threw "Cannot read properties of undefined (reading 'update')" on every tick.
- Portable exe: `-c.portable.unpackDirName=GrannyxDBD-1.4.3` on the command line (builder.json no longer sets it).
- Devlog banner: tools/test/devlog143-page.js (`PAGE=devlog143-page.js OUT=x.png node render-devlog.mjs`); the banner for the
  full 1.4.3 update (Nosferatu + the Forest + add-ons, UV beam) is devlog143b-page.js (APK versionCode 23 for that build).
- **Slendrina: The Forest** (`forest`): tools/forest/build_forest.py (UnityPy) turns the owner's `Slendrina The Forest_Data`
  (level1 + sharedassets1.assets + .resS, shared on Google Drive; not in the repo) into public/models/forest_map.glb (prototypes
  proto_Stam/Grenar/RockMesh/Utelykta + landmark groups group_house/stall/oldhouse/shelter/car; Unity mirrored on X, ground
  lifted 0.79; only cut-out shaders get alpha) and public/js/forestdata.js (every tree's trunk/crown matrix + collision radius,
  rocks, each group's 0.5 m collision boxes, holes filled). map.js `FORESTMAP`: buildArena on a 5x5 grid (xs/zs ±42/±21),
  landmark cells `marks` (never a corner); generator / hook spots picked round each building after all cells are built; the
  woods templates fill the rest (no procedural trees); the real trees inside the fence become invisible 'mesh' circles (any
  in the way of a set piece, gen, hook, gate or spawn is dropped), the ones outside are drawn only. forestworld.js draws
  trunks + crowns as InstancedMesh and clones the landmark groups. LOOK.forest (dark mist), wooden 'boards' fence.
  Map vote pictures are inlined into the offline build (`window.__MAPIMG`, build.mjs) since the exe/apk have no img/ folder.
- Item add-ons (`ADDONS`, `ADDON_SLOTS` 2, `addonMods(list, item)` in config.js; idea and the UV Torch by Ommm and WolfSpider,
  credited in How to Play, Store and the inbox): Store > Add-ons (`profile.addons` owned), survivor Loadout row
  (`profile.survivor.addons`), sent as `addons` (roster / loadouts, STATIC in snap.js). Sim: flashlight battery x battery
  (`flashMax`), range / beam cone / blind speed / blind+stun time in `flashKiller`; taser range/stun, +shots on a fresh chest
  taser (`fresh` flag). UV Torch beam is violet (game.js `BEAM_MAT_UV`). Bot survivors bring one half the time.
- Grandpa balance (1.4.3): shotgun 26-55 dmg (2 long shots, 3 mid, 4 close), cooldown 2.6, raise 0.45, reveal 4; the shotgun bar
  (`shp`) refills 3/s after 8 s without a hit (`shpT`); traps snare 3 s, reveal 4 s, seen from 6 m.
- Mobile (owner's Discord feedback): the 1.3.3 button drawings are back (TC_ICONS, `night` moon icon, Nosferatu 'fangs');
  a quick tap on USE latches it (held until the action ends, USE again, or the joystick moves; 1.2 s grace to start).
- Smarter survivor bots: `this.intel` (last place anyone saw the killer, shared), generator spreading (bots already heading to a
  generator count against it), `leadPenalty` (flee spots near teammates repairing/healing score lower), injured bots go to a
  teammate to be healed (`mend`, wait up to 4 s), `b.brave` squeeze past a known bear trap that blocks the way.
1.4.2: DBD-style skill check (`drawSkill`, HiDPI), second-killer picker for Two Killers bot matches
(`botsCfg.killer2`), Angeline's bone matrices kept rigid (no squashed head: `toBindPose` composes position from K and the
rotation only), version-aware single instance + versioned unpack dir for the exe, backup button in Settings.
APK versionCode 17 / 1.4.2, Windows 1.4.2, VERSION '1.4.2'.
1.4.1: Profile panel, disk save mirror (exe + apk), backup codes, the Child's picture in the offline builds.
APK versionCode 16 / 1.4.1, Windows 1.4.1, `VERSION = '1.4.1'` (NET_PROTOCOL still 13: plays with 1.4.0).
1.4: character levels + stats, The Child of Slendrina sidekick, Two Killers (2v8), seasons + ranks + season
pass with a premium track, perk HUD fix, camera ray-cast. APK versionCode 15 / 1.4.0 (signed with grannyxdbd-1.3.jks),
Windows app 1.4.0. Devlog banner "LEVEL UP · AND MEET THE CHILD" (tools/test/devlog14-page.js, PAGE=... OUT=... render-devlog.mjs).
1.3.1: Angeline animated in code (see Angeline above); APK versionCode 14 / 1.3.1, Windows app 1.3.1
(config.js `VERSION` still says '1.3.0', NET_PROTOCOL 12: 1.3.0 and 1.3.1 play together). Main branch = latest.

Nov 2026 fixes (APK versionCode 16): loading screen no longer shows the menu through it (`html.ls-up` hides every body
child but #game/#loading/#toast); `Game.warmUp()` runs behind the loading screen before the first match frame (characters
created with drawing off, textures via `initTexture`, shaders via `compileAsync` when KHR_parallel_shader_compile exists,
then one real frame): the first frame used to compile ~85 shaders + upload ~120 textures at once (37 s in SwiftShader);
the loading screen renders with its own `shadowMap.enabled` (= !lite) so menu/match switches don't recompile its shaders;
WebGL context lost/restored handler in main.js (`watchContext`): rebuilds the PMREM night-sky env maps (`refreshEnvs` in
gfx.js) and reloads the page if the context isn't back in 12 s; KTX2 scans with sizes not a multiple of 4 (hessian_230,
rough_linen) are dropped (black on BC GPUs); `closePanel(byPlayer)`: only the player closing the lobby panel leaves the
room (the weekly-awards popup used to kick people out of a lobby they joined during startup, e.g. invite links).
granny_map.glb has 7 zero-length images (Button, ShotgunAmmo, Slingshot, Teddy, Coconut, GoldCoin, GateControlFuse_1): those
props render untextured (white). New checks in tools/test: `diag.mjs <killer> <map> <quality>` (load time, longest frame
stalls, texture/program counts), `ctxloss.mjs` (lose + restore the context mid-match), `lsover.mjs` (loading screen over
the menu), `onlinestart.mjs` (host + client start a match through the local broker; run `node broker.mjs` first).

## Where things stand / next steps
- The "textures go missing / very dark" report (EXE + APK) is not reproduced in SwiftShader; fixes above cover the likely
  causes (GPU reset after the long first frame, context loss on phones). Ask the owner for a screenshot + quality setting
  if it still happens.
- The 1.3.x APKs are signed with a key made in the 1.3 session (`grannyxdbd-1.3.jks`, alias `grannyxdbd`), which was handed
  to the owner as a file together with its password file. For the next APK the owner puts that .jks in `tools/android/` (or
  passes `KS=/path`) and sets `KS_PASS` from the password file, so the update installs over 1.3.x. Never ask for the password
  in chat; if the owner doesn't have the key, a new key means players uninstall first.
- Not yet tested on a real phone (only Chromium phone emulation) and the public lobby list was tested against a local relay,
  not the public brokers.
- Ideas not done: a 1.3 YouTube Short / trailer with Angeline; bump `VERSION` to 1.3.1 next time anything ships.
1.2: Granny's Old House enterable, stronger shotgun, taller Slendrina (1.95m), smarter bots, YouTube Short #2
("SHE'S NOT ALONE ANYMORE.", rendered in-engine, synthesized score).
1.1: Grandpa as his own killer, Slendrina, Granny's Old House, bot stall fixes, portable Windows exe,
devlog thumbnail (rendered in-engine: the three killers at the Granny 1 house's front door).
