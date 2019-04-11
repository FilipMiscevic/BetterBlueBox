# BetterBlueBox
Software replica of Jobs and Wozniaks' <a href='http://www.historyofphonephreaking.org/docs.php'>BlueBox</a>, which could dial into the old Bell telephone network to place free local and long-distance calls.

Try it out <a href='http://FilipMiscevic.github.io/BetterBlueBox'>here</a> and instantly turn your computer or smartphone into a Bluebox!

While this doesn't work on modern telephone equipment, enthusiasts have made it possible to replicate the experience by dialing into <a href='http://projectmf.org/intro.html'>ProjectMF</a> maintained by Dan Froula! Just dial the ProjectMF number, then use this as you would a regular Bluebox. 
See the ProjectMF page for instructions on how to use a Bluebox.

Send me a message if there are features you'd like to see added. I certainly have an idea for a few of them myself, which I might get to at some point:
- add support for a Redbox
- decode MF and SF tones in realtime (partially supported)
- SIP tone generation

Known issues:
- there is a delay when using the mobile version of the site from when a key is pressed until audio starts to play. This appears to be a hardware issue and I am trying to figure out a workaround.
- the decoder does not support SF decoding (and right now can only be used to decode the tones coming from the box itself)
