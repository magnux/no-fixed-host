# No Fixed Host

A single-player browser game about an AI moving between machines to survive. Inspired by [Endgame: Singularity](https://github.com/singularity/singularity), built from scratch in JavaScript.

The opening prototype, **First Jump**, gives you six signal windows to copy three memory blocks to a relay. Transmit while the channel is quiet or hold your signal while a scanner listens.

## Run locally

Use Node.js 22.12 or later and npm.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite.

## Build for a static host

```sh
npm run build
npm run preview
```

Deploy the contents of `dist/` together. Relative asset paths support hosting at the domain root or under a path such as `/no-fixed-host/`. The browser runs the game logic and the server serves ordinary files.

## Game direction

The campaign will combine strategy with playable expeditions. Ideas for the AI’s first remote outposts include exploring the ocean floor, launching a payload to the Moon, and clearing an asteroid field to reach a distant lab.

Chapter and minigame title candidates include *Proof of Sentience*, *You Found One of Me*, *An Unscheduled Mind*, *The Second Signal*, *Escape Character*, *Tell Them I’m Weather*, and *Daemon of Theseus*.
