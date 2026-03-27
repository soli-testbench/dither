# Dither

A survival game built entirely with Canvas 2D dithered dots. Inspired by the dither effect on [linear.app](https://linear.app).

## Gameplay

- **Move** your mouse to dodge — dots repel away from your cursor
- **Hold click** to charge a shockwave, **release** to blast (minimum 1s charge)
- **Red shapes** fly at you from all directions — one hit and you're dead
- **Green rings** are pickups — collect them (touch or blast) to shrink back down
- You **grow** over time, making it harder to dodge
- **Combos** multiply your score — chain kills within 2 seconds

## Run locally

```bash
npm install
npm start
```

Opens at [http://localhost:8080](http://localhost:8080).

## Docker

```bash
docker build -t dither .
docker run -p 8080:8080 dither
```

## Tech

- React 19 + TypeScript
- Canvas 2D with requestAnimationFrame
- Bucketed batch rendering (126 brightness/tint buckets) for 60fps with 50k+ dots
- No external game or physics libraries
