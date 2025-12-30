# Tetris Time

A clock that displays the time using falling Tetris pieces. Watch the tetrominoes fall into place to form the current time.

**Live demo:** [tetris-time.koenvangilst.nl](https://tetris-time.koenvangilst.nl)

## URL Parameters

### Clock Mode (default)

By default, the clock displays the current time. No parameters needed.

### Countdown Mode

Use the `to` parameter to count down to a specific date:

- **New Year:** [?to=newyear](https://tetris-time.koenvangilst.nl/?to=newyear)
- **Specific date (UTC):** [?to=2025-12-31T23:59:00Z](https://tetris-time.koenvangilst.nl/?to=2025-12-31T23:59:00Z)
- **With timezone offset:** [?to=2025-07-04T12:00:00-04:00](https://tetris-time.koenvangilst.nl/?to=2025-07-04T12:00:00-04:00)

### Speed

Use the `speed` parameter to control animation speed (default: 3, higher = faster):

- **Slow:** [?speed=1](https://tetris-time.koenvangilst.nl/?speed=1)
- **Fast:** [?speed=5](https://tetris-time.koenvangilst.nl/?speed=5)
- **Combined:** [?to=newyear&speed=5](https://tetris-time.koenvangilst.nl/?to=newyear&speed=5)

## Development

To run locally:

```bash
npm install
npm run dev
```

Then open the link provided in your terminal.

## Credits

Color palette from the [Mindful Palette](https://x.com/AlexCristache/status/2004124900748116212) by Alex Cristache.

## License

MIT
