/* ServerLab settings.

   Online saving is OFF while both values below are empty. Accounts and points are then saved in
   each student's own browser only, so they are NOT shared and can be lost.

   To share accounts, progress and the leaderboard with the whole class, make a free Firebase
   project (steps are in README.md, section "Turn on online saving") and paste its two values here:

     apiKey       Firebase console > Project settings > General > Your apps > Web app > apiKey
     databaseURL  Firebase console > Build > Realtime Database > the https://...firebasedatabase.app address

   These two values are not secrets. The database rules in README.md are what keep accounts safe. */
SL.CONFIG = {
  firebase: {
    apiKey: '',
    databaseURL: '',
  },
};