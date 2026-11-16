# ServerLab: Windows Server 2019 install simulator (COC 3)

Open `index.html` in any browser. No install, no build step. Keep all the files in the same folder.

Out of the box, accounts are saved in each student's own browser only. To save accounts **online**, so students can log in from any device and everyone sees the same leaderboard, follow "Turn on online saving" below. It takes about 10 minutes and is free.

## Read the code in this order

| # | File | What it is | Edit it when you want to... |
|---|------|------------|-----------------------------|
| 1 | `index.html` | The empty page. Loads the fonts, the CSS and the scripts. | change the page title |
| 2 | `data.js` | All the content: the 13 install steps, the editions list, the 10 quiz questions, badges, levels, sample classmates, `SL.PASS = 60`. | change wording, add quiz questions, change the pass mark |
| 3 | `logic.js` | The rules, with no screen code. `SL.check()` decides if a click is right or wrong and writes Forge's explanation. Also scoring, levels, badges, quiz marking, the leaderboard order. | change what counts as right or wrong, or how points work |
| 4 | `config.js` | Two settings for online saving (`apiKey`, `databaseURL`). Empty = browser-only. | turn online saving on |
| 5 | `store.js` | Where accounts, progress and the leaderboard are kept. A browser-only store and an online (Firebase) store, with the same functions. | change how or where things are saved |
| 6 | `ui.js` | Draws every screen (sign in, home, lesson, quiz, result, leaderboard, badges) and the fake Windows Setup screens. Buttons use `data-act="..."` and one click handler passes them on. | change a screen layout or add a new simulated screen |
| 7 | `style.css` | The look. The five brand colours and the colour tokens are at the top (`:root`), dark mode right after. Phone and tablet rules are the `@media` blocks. | change colours, spacing, responsive behaviour |

Optional developer files: `test.js` and `test-cloud.js` (run `node test.js` and `node test-cloud.js` to check the rules and the online saving without a browser or internet), `fake-firebase.js` (the stand-in server those tests use), `build.js` (makes a one-file copy of the site).

## How the pieces fit

1. `ui.js` draws a step from `data.js`.
2. The student clicks. `ui.js` sends the click to `SL.check()` in `logic.js`.
3. `logic.js` answers `ok` (points), `bad` (Forge explains why), `local` (just changes the screen) or `nudge` (a greyed-out button was clicked).
4. `ui.js` shows Forge's reaction and calls `store.save()`, which writes the progress and the student's leaderboard entry.

## Points

- Lesson step: 10 points first try, 5 after a mistake or hint. Challenge mode doubles it (20 / 10).
- Assessment: 10 points for each correct answer, best attempt counts.
- Most points possible: 360. Pass mark: 60%.
- Replaying a step never earns more than your best score for it.

## Turn on online saving (Firebase, free)

You need a Google account. Menu names in Firebase move around a little from time to time, but the order below stays the same.

1. **Create a project.** Go to https://console.firebase.google.com, click **Create a project**, name it `serverlab`, turn Google Analytics off, click **Create project**.
2. **Add a web app.** On the project home page click the web icon `</>`, name it `ServerLab`, click **Register app**. You will see a block of settings. Copy the value of `apiKey` (it starts with `AIza`). You can click Continue to console, hosting is not needed.
3. **Switch on logins.** In the left menu open **Build > Authentication > Get started > Sign-in method**, click **Email/Password**, switch **Enable** on (leave "Email link" off) and **Save**.
4. **Create the database.** Open **Build > Realtime Database > Create Database**. Pick the location closest to your school, choose **Start in locked mode**, click **Enable**. Copy the address at the top of the Data tab. It looks like `https://serverlab-12345-default-rtdb.asia-southeast1.firebasedatabase.app`.
5. **Paste the safety rules.** Open the **Rules** tab, delete everything in the box, paste this, click **Publish**:

```json
{
  "rules": {
    "accounts": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "profiles": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && auth.uid === $uid",
        ".validate": "newData.hasChildren(['name', 'points']) && newData.child('name').isString() && newData.child('name').val().length <= 40 && newData.child('points').isNumber() && newData.child('points').val() >= 0 && newData.child('points').val() <= 360"
      }
    }
  }
}
```

   What they do: each student can read and write only their own `accounts` record. The `profiles` list (name and points, used for the leaderboard) can be read by any logged-in student but changed only by its owner, and points must be between 0 and 360.
6. **Paste your two values into `config.js`:**

```js
SL.CONFIG = {
  firebase: {
    apiKey: 'AIza...your key...',
    databaseURL: 'https://serverlab-12345-default-rtdb....firebasedatabase.app',
  },
};
```

7. **Upload the changed files** to wherever the site is hosted (for GitHub Pages: open the repository, **Add file > Upload files**, drop in all the files, **Commit changes**). Wait 1 to 2 minutes.
8. **Check it works.** Create an account, play one step, log out. Open the site on a different device or browser, log in with the same student ID and password. Your points should be there, and the Leaderboard should list everyone who has an account.

The sign-in screen tells students which mode they are in: "Your account, points and badges are saved online" means it is working. "Online saving is off" means `config.js` is still empty.

### Good to know

- **Passwords** are handled by Firebase Authentication. ServerLab never stores them, and your teacher cannot see them. A student who forgets a password needs a new account with a new student ID, or you can delete the old one in **Authentication > Users** and let them sign up again.
- **Student ID rule:** 2 to 30 letters or numbers, with dashes or underscores allowed in the middle (for example `2026-0142`). It becomes the login name.
- **Names are public.** The leaderboard shows each student's name to every logged-in student. Tell students they can use a nickname.
- **Points are worked out in the browser.** The rules cap them at 360, but a determined student could still edit their own score. That is fine for a class game. If marks count, scoring has to move to a server.
- **Deleting a student:** Authentication > Users > delete the user, then Realtime Database > Data > delete their `accounts/<id>` and `profiles/<id>` entries.
- **Cost:** the free Firebase plan is far more than a class needs.
- If something goes wrong, the app shows the reason on the sign-in screen: wrong `apiKey`, Email/Password not switched on, rules not published, or no internet.

## Adding COC 4 later

Add a new lesson in `data.js` (steps with `title`, `goal`, `hint`, `ok`), add its rules as a new `case` in `SL.check()` in `logic.js`, and add its screens to `ui.js`. The home screen already has a "COC 4" placeholder card.