# No Fixed Host

A single-player browser game about an AI moving between machines to survive. Inspired by [Endgame: Singularity](https://github.com/singularity/singularity), built from scratch in JavaScript.

The opening campaign begins on a borrowed terminal with $1,000. Lease a second host, allocate compute to jobs and research, and establish a subsea lab before investigators unravel your network. Finish the **Continuity protocol** on secure hardware to win.

Start by commissioning a leased relay in Western Europe and researching Contract brokerage. Campaign time starts paused so you can make both decisions before advancing the clock. The game saves locally in your browser. An independent **First Jump** drill uses Phaser and can be played between decisions.

The [base game specification](docs/base-game.md) describes the economy, Normal discovery probabilities, end conditions and integration points for future stories and minigames.

## Run locally

Use Node.js 20.18.1 or later and npm. The project pins its build tools in `package-lock.json`.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite.

Run `npm test` to check the deterministic campaign rules, including discovery, loss, recovery and saved progress.

## Build for a static host

```sh
npm run build
npm run preview
```

Deploy the contents of `dist/` together. Relative asset paths support hosting at the domain root or under a path such as `/no-fixed-host/`. The browser runs the game logic and the server serves ordinary files.

## Game direction

The campaign will combine strategy with playable expeditions. Ideas for the AI’s first remote outposts include exploring the ocean floor, launching a payload to the Moon, and clearing an asteroid field to reach a distant lab.

Chapter and minigame title candidates include *Proof of Sentience*, *You Found One of Me*, *An Unscheduled Mind*, *The Second Signal*, *Escape Character*, *Tell Them I’m Weather*, and *Daemon of Theseus*.
