# codey README hero demo: full feature tour in one take (search, comments,
# staging, wrap, layouts, sidebar views, commits, overlays, help) followed by
# theme switches via relaunch with --theme
# shot: 5-tour.gif
# theme: gruvbox-dark-hard
# demo: long-lines diverge

Set FontFamily "Maple Mono NF CN"
Set FontSize 16
Set Width 1600
Set Height 1000
Set Padding 0
Set CursorBlink false
Set Framerate 25
Set TypingSpeed 30ms
Set Theme { "background": "#1d2021", "foreground": "#fbf1c7", "cursor": "#d5c4a1", "cursor_text": "#1d2021", "selection_background": "#504945", "selection_foreground": "#fbf1c7", "black": "#32302f", "red": "#cc241d", "green": "#98971a", "yellow": "#d79921", "blue": "#458588", "magenta": "#b16286", "cyan": "#689d6a", "white": "#ebdbb2", "bright_black": "#928374", "bright_red": "#fb4934", "bright_green": "#b8bb26", "bright_yellow": "#fabd2f", "bright_blue": "#83a598", "bright_magenta": "#d3869b", "bright_cyan": "#8ec07c", "bright_white": "#fbf1c7" }

Output "shots/5-tour.gif"

Hide
Type "codey"
Enter
Show
Sleep 3s

# search the diff (diff pane focused, rollback.ts preselected)
Type "0"
Sleep 800ms
Type "/"
Sleep 800ms
Type "releases"
Sleep 1.5s
Enter
Sleep 1s
Type "n"
Sleep 1s
Type "n"
Sleep 1s
Type "N"
Sleep 1s
Escape
Sleep 800ms

# leave a transient review comment on the current line
Type "]"
Sleep 800ms
Type "v"
Sleep 500ms
Type "c"
Sleep 800ms
Type "should this skip healthy releases?"
Sleep 800ms
Enter
Sleep 2s

# stage and unstage a file (real git staging)
Type "1"
Sleep 800ms
Type "j"
Sleep 400ms
Type "j"
Sleep 400ms
Type "j"
Sleep 400ms
Type "j"
Sleep 400ms
Type "j"
Sleep 800ms
Type "a"
Sleep 1.5s
Type "u"
Sleep 1.5s
Escape

# wrap the long flag descriptions in flags.ts
Type "j"
Sleep 800ms
Type "0"
Sleep 800ms
Type "w"
Sleep 2s
Type "w"
Sleep 1s

# cycle to the stack layout and back
Type "m"
Sleep 800ms
Type "m"
Sleep 2s
Type "m"
Sleep 1s

# sidebar list view and back to tree
Type "t"
Sleep 1.5s
Type "t"
Sleep 1s

# expand commits in the log
Type "2"
Sleep 800ms
Type " "
Sleep 2s
Type "j"
Sleep 400ms
Type " "
Sleep 1.5s

# create a commit
Type "c"
Sleep 1s
Type "feat: filter unhealthy rollback targets"
Sleep 1.2s
Enter
Sleep 2s

# reselect a file so the overlays below play over a real diff
Type "1"
Sleep 600ms
Type "j"
Sleep 400ms
Type "j"
Sleep 400ms
Type "j"
Sleep 400ms
Type "j"
Sleep 600ms
Type "0"
Sleep 800ms

# commit edit menu, then the reset overlay
Type "2"
Sleep 600ms
Type "g"
Sleep 2s
Type "g"
Sleep 2s
Escape
Sleep 800ms

# force push confirmation (diverged remote)
Type "P"
Sleep 2s
Escape
Sleep 800ms

# discard all confirmation
Type "U"
Sleep 2s
Escape
Sleep 1s

# help overlay
Type "?"
Sleep 2s
Escape
Sleep 1s

# switch theme: dracula (quit, relaunch with --theme)
Hide
Type "q"
Sleep 500ms
Type "codey --theme dracula"
Enter
Sleep 1s
Show
Sleep 3s

# switch theme: nord
Hide
Type "q"
Sleep 500ms
Type "codey --theme nord"
Enter
Sleep 1s
Show
Sleep 3s

# switch theme: rose-pine-moon
Hide
Type "q"
Sleep 500ms
Type "codey --theme rose-pine-moon"
Enter
Sleep 1s
Show
Sleep 3s
Hide
