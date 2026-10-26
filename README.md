# Flash Alarm

A small browser alarm that enters full-screen and flashes the display, plays a repeating tone, and can show a desktop notification when the chosen time arrives in the selected time zone.

## Run it

Open `public/index.html` in a browser, choose an alarm time and time zone, set the alarm, and leave the page open. Setting the alarm requests browser full-screen so the flash can fill the display. If the chosen time has already passed today in that zone, the alarm is scheduled for tomorrow there. The alarm is saved in that browser on that device.

## Publish with GitHub and Cloudflare

1. Create a GitHub repository and add these files to it.
2. In the Cloudflare dashboard, open **Workers & Pages** and choose **Create application**.
3. Choose **GitHub**, connect the repository, and select it.
4. Keep the project root as the repository root. The repository includes `wrangler.jsonc` and the site files are in `public/`.
5. Save and deploy. Cloudflare will provide a `workers.dev` address. Later pushes to the connected production branch can deploy updates automatically.

This project has no build step or server-side alarm service.

## Alarm limitations

- Keep the browser page open and the computer awake for the alarm to fire on time.
- Full-screen mode lets the browser page cover the display. If the browser blocks full-screen, the flash covers only its window. A desktop notification is optional and depends on notification permission and browser support.
- If the computer sleeps or the browser closes, the alarm cannot flash at its scheduled time. If the page is reopened after the scheduled time, it will ring then.
- The browser may limit sound until the user has interacted with the page. The flashing alert remains the primary signal.
