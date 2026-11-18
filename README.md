# _“Your Life in…”_

An interactive life calendar and timeline visualizer that maps a 100-year human life across multiple scales of time — from seconds and minutes to days, weeks, months, and years. Inspired by the visual essay by American writer and blogger Tim Urban, published in May 2014 on [Wait But Why](https://waitbutwhy.com/2014/05/life-weeks.html).

## How It Works

1. **Seconds**: The current year is broken down into days, and the current day is magnified in seconds.
2. **Minutes**: The current year is broken down into weeks, and the current week is magnified in minutes.
3. **Hours**: The current year is directly magnified into hours.
4. **Days, Weeks, Months, and Years**: Displayed directly across your entire 100-year lifespan.

Visualizing seconds, minutes, and hours through cascading levels is a deliberate design choice: rendering all 3.15 billion seconds or 52 million minutes of a human life at once on a single screen is physically and computationally impractical.

### Personal Timeline vs. Calendar Time

Calculations are anchored to your **personal timeline** rather than standard calendar dates. For instance, weeks are calculated in 7-day intervals starting from your exact birth date (representing your personal weeks of life, rather than Monday–Sunday calendar weeks). The same logic applies to months and years. While the interface visualizes your personal milestones, the underlying mathematics strictly accounts for leap years, varying month lengths, and local time offsets.

### Interactive Features

- **Birthdays**: Click **“Date of birth”** to switch to the Days scale and highlight every birthday in red across your timeline.
- **Life Expectancy**: Select **Male** or **Female** to display a glowing marker for global average life expectancy (WHO data).
- **Live Ticker**: At the bottom of the timeline, a real-time counter displays how much of your life has passed in your selected time unit. The decimal precision is calibrated specifically to reveal the relentless, unceasing progression of time.

Enjoy your existential crisis! :-D

---

[MIT License](LICENSE) © 2026
