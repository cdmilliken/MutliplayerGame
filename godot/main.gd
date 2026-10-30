extends Control
## Godot 4 client for the same anonymous API used by the browser game.
## Change Project Settings > backend/url to point to your own deployment.

const INK := Color("252720")
const ORANGE := Color("ec5b35")
const MUTED := Color("777b6d")
var backend: String = str(ProjectSettings.get_setting("backend/url")).trim_suffix("/")
var player_id: String = ""
var nickname: String = ""
var room_code: String = ""
var room: Dictionary = {}
var content: VBoxContainer
var status_label: Label
var countdown: Label
var name_input: LineEdit
var code_input: LineEdit
var poll_timer: Timer
var busy: bool = false
var polling: bool = false
var generation: int = 0
var clock_offset: float = 0.0
var last_render: String = ""

func _ready() -> void:
	var theme_new := Theme.new()
	theme_new.default_font_size = 18
	theme_new.set_color("font_color", "Label", INK)
	theme_new.set_color("font_color", "LineEdit", INK)
	var field := StyleBoxFlat.new()
	field.bg_color = Color("fffef9")
	field.border_color = Color("deded3")
	field.set_border_width_all(1)
	field.set_corner_radius_all(8)
	field.content_margin_left = 14
	field.content_margin_right = 14
	theme_new.set_stylebox("normal", "LineEdit", field)
	theme = theme_new
	var scroll := ScrollContainer.new()
	scroll.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)
	var margin := MarginContainer.new()
	margin.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 28)
	scroll.add_child(margin)
	var layout := VBoxContainer.new()
	layout.add_theme_constant_override("separation", 22)
	layout.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	margin.add_child(layout)
	var brand := label("//  split decision", 28)
	layout.add_child(brand)
	layout.add_child(HSeparator.new())
	content = VBoxContainer.new()
	content.add_theme_constant_override("separation", 18)
	layout.add_child(content)
	status_label = label("", 15, Color("ad3d26"))
	layout.add_child(status_label)
	var home_button := make_button("Back to home", func():
		generation += 1
		room = {}
		room_code = ""
		last_render = ""
		save_session()
		show_home()
	, false)
	layout.add_child(home_button)
	layout.add_child(label("No accounts. No installs for browser friends.\n3–12 players · 5 rounds · one smaller crowd.", 14, MUTED))
	load_session()
	show_home()
	poll_timer = Timer.new()
	poll_timer.wait_time = 1.0
	poll_timer.timeout.connect(poll)
	add_child(poll_timer)
	poll_timer.start()
	if not room_code.is_empty():
		poll()

func label(text: String, size: int = 18, color: Color = INK) -> Label:
	var node := Label.new()
	node.text = text
	node.add_theme_font_size_override("font_size", size)
	node.add_theme_color_override("font_color", color)
	node.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	node.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return node

func make_button(text: String, callback: Callable, primary: bool = true) -> Button:
	var node := Button.new()
	node.text = text
	node.custom_minimum_size.y = 54
	node.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	node.add_theme_font_size_override("font_size", 18)
	var style := StyleBoxFlat.new()
	style.bg_color = ORANGE if primary else Color("e5e9d9")
	style.set_corner_radius_all(8)
	style.content_margin_left = 15
	style.content_margin_right = 15
	style.content_margin_top = 12
	style.content_margin_bottom = 12
	node.add_theme_stylebox_override("normal", style)
	var hover := style.duplicate() as StyleBoxFlat
	hover.bg_color = style.bg_color.lightened(0.08)
	node.add_theme_stylebox_override("hover", hover)
	node.add_theme_stylebox_override("pressed", style)
	node.add_theme_stylebox_override("disabled", style)
	for state in ["font_color", "font_hover_color", "font_pressed_color", "font_disabled_color"]:
		node.add_theme_color_override(state, Color("fffef9") if primary else INK)
	node.pressed.connect(callback)
	return node

func clear_content() -> void:
	countdown = null
	for child in content.get_children():
		content.remove_child(child)
		child.queue_free()
	status_label.text = ""

func show_home() -> void:
	clear_content()
	content.add_child(label("Great minds\nthink different.", 48))
	content.add_child(label("Pick a side. Dodge the crowd.\nThe smaller group wins.", 21, MUTED))
	content.add_child(label("YOUR NICKNAME", 13))
	name_input = LineEdit.new()
	name_input.placeholder_text = "Your best nickname"
	name_input.max_length = 18
	name_input.text = nickname
	name_input.custom_minimum_size.y = 54
	content.add_child(name_input)
	content.add_child(make_button("Create a room  →", func(): send_action("create")))
	content.add_child(make_button("Play solo · 4 bots  →", func(): send_action("create_solo"), false))
	content.add_child(label("Test all five rounds with four automatic opponents. No friends needed.", 15, MUTED))
	content.add_child(label("OR JOIN YOUR FRIENDS", 13))
	code_input = LineEdit.new()
	code_input.placeholder_text = "Five-letter room code"
	code_input.max_length = 5
	code_input.custom_minimum_size.y = 54
	content.add_child(code_input)
	content.add_child(make_button("Join a room  →", func(): send_action("join"), false))
	add_rules()

func add_rules() -> void:
	content.add_child(HSeparator.new())
	content.add_child(label("THE SHORT VERSION", 13, ORANGE))
	content.add_child(label("1. Pick one of two options secretly in 20 seconds.\n\n2. The less popular side gets +1 point. A tie or missed pick scores zero.\n\n3. After five rounds, most points wins. Tied leaders share the win. Rounds advance automatically.", 17, MUTED))

func send_action(action: String, extra: Dictionary = {}) -> void:
	if busy:
		return
	if action == "create" or action == "create_solo" or action == "join":
		nickname = name_input.text.strip_edges()
		if action == "create_solo" and nickname.is_empty():
			nickname = "Player"
		if nickname.is_empty():
			status_label.text = "Enter a nickname first."
			return
		if action == "join":
			room_code = code_input.text.strip_edges().to_upper()
			if room_code.length() != 5:
				status_label.text = "Enter a five-letter room code."
				return
	busy = true
	generation += 1
	var request_generation: int = generation
	status_label.text = "Connecting…"
	var payload := {"action": action, "id": player_id, "name": nickname, "code": room_code, "round": room.get("round", 0)}
	payload.merge(extra, true)
	var request := HTTPRequest.new()
	request.timeout = 12.0
	add_child(request)
	request.request_completed.connect(func(result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray):
		request.queue_free()
		busy = false
		if request_generation != generation:
			return
		handle_response(result, response_code, body)
	)
	var error := request.request(backend + "/api/room", ["Content-Type: application/json"], HTTPClient.METHOD_POST, JSON.stringify(payload))
	if error != OK:
		request.queue_free()
		busy = false
		status_label.text = "Could not connect. Check your connection and try again."

func poll() -> void:
	if busy or polling or room_code.is_empty():
		return
	polling = true
	var request_generation: int = generation
	var request := HTTPRequest.new()
	request.timeout = 8.0
	add_child(request)
	request.request_completed.connect(func(result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray):
		request.queue_free()
		polling = false
		if request_generation == generation:
			handle_response(result, response_code, body)
	)
	var error := request.request(backend + "/api/room?code=" + room_code.uri_encode() + "&id=" + player_id.uri_encode())
	if error != OK:
		request.queue_free()
		polling = false
		status_label.text = "Connection interrupted. Retrying automatically…"

func handle_response(result: int, response_code: int, body: PackedByteArray) -> void:
	if result != HTTPRequest.RESULT_SUCCESS:
		status_label.text = "Connection interrupted. Retrying automatically…"
		return
	var data = JSON.parse_string(body.get_string_from_utf8())
	if not data is Dictionary:
		status_label.text = "Server unavailable. Try again shortly."
		return
	if response_code != 200 or data.has("error"):
		status_label.text = str(data.get("error", "Unable to connect."))
		if response_code == 404:
			room_code = ""
		return
	room = data
	room_code = str(room.code)
	clock_offset = float(room.serverNow) - Time.get_unix_time_from_system() * 1000.0
	save_session()
	status_label.text = ""
	var render_data := room.duplicate(true)
	render_data.erase("serverNow")
	var fingerprint := JSON.stringify(render_data)
	if fingerprint != last_render:
		last_render = fingerprint
		show_room()

func show_room() -> void:
	clear_content()
	var solo: bool = room.get("mode", "multiplayer") == "solo"
	content.add_child(label("SOLO PRACTICE · 4 BOTS" if solo else "ROOM  " + room_code, 22, ORANGE))
	if not solo:
		content.add_child(make_button("Copy invite link", func():
			DisplayServer.clipboard_set(backend + "/?room=" + room_code)
			status_label.text = "Invite copied! Room code: " + room_code
		, false))
	var phase: String = str(room.phase)
	if phase == "lobby":
		content.add_child(label("Get the gang together.", 40))
		content.add_child(label("Share the code. Everyone uses their own phone, laptop, or Godot client.\n\n%d / 12 friends in the room" % room.players.size(), 19, MUTED))
		if room.isHost:
			var start := make_button("Everybody in? Let’s play  →", func(): send_action("start"))
			start.disabled = room.players.size() < 3
			content.add_child(start)
			if room.players.size() < 3:
				content.add_child(label("Invite at least 3 players to start.", 16, MUTED))
		else:
			content.add_child(label("Waiting for the host to start…", 18, MUTED))
		add_rules()
	elif phase == "finished":
		var high: int = 0
		for p in room.players:
			high = maxi(high, int(p.score))
		var winners: PackedStringArray = []
		for p in room.players:
			if int(p.score) == high:
				winners.append(str(p.name))
		content.add_child(label("Great minds win.", 42))
		content.add_child(label(" & ".join(winners) + "\n%d points · Nicely played." % high, 24, ORANGE))
		content.add_child(make_button("Run it back  →", func(): send_action("rematch")))
	else:
		content.add_child(label("ROUND %d / 5" % int(room.round), 16, MUTED))
		countdown = label("", 20, ORANGE)
		content.add_child(countdown)
		var prompt: Array = room.prompt
		content.add_child(label(str(prompt[0]), 38))
		var message := "Pick the side fewer friends will choose."
		if phase == "reveal":
			message = "Even split! No points." if room.get("winner") == null else "The smaller crowd gets +1 point."
		elif room.choice != null:
			message = "Pick locked. Waiting for everyone else…"
		content.add_child(label(message, 18, MUTED))
		for side in range(2):
			var option_text: String = str(prompt[1 + side])
			if room.choice != null and int(room.choice) == side:
				option_text = "✓ " + option_text
			if phase == "reveal":
				option_text += "\n%d votes" % int(room.counts[side])
				if room.winner != null and int(room.winner) == side:
					option_text += " · +1 point"
			var choice: int = side
			var button := make_button(option_text, func(): send_action("vote", {"choice": choice}), side == 0)
			button.custom_minimum_size.y = 90
			button.disabled = phase != "picking" or room.choice != null
			content.add_child(button)
			if phase == "reveal":
				var voters: PackedStringArray = []
				for p in room.players:
					if p.get("choice") != null and int(p.choice) == side:
						voters.append(str(p.name))
				content.add_child(label(", ".join(voters) if not voters.is_empty() else "Nobody here", 15, MUTED))
		content.add_child(label("%d of %d picks locked" % [int(room.voted), room.players.size()], 16, MUTED))
	content.add_child(HSeparator.new())
	content.add_child(label("THE GOOD COMPANY" if phase == "lobby" else "THE STANDINGS", 14, ORANGE))
	var sorted: Array = room.players.duplicate()
	sorted.sort_custom(func(a, b): return int(a.score) > int(b.score))
	for p in sorted:
		var suffix: String = " (you)" if p.me else ""
		if p.get("bot", false):
			suffix += " [BOT]"
		var info: String = "Host" if p.host else "Ready"
		if phase != "lobby":
			info = "%d points" % int(p.score)
			if phase == "picking":
				info += " · locked" if p.voted else " · thinking…"
		content.add_child(label(str(p.name) + suffix + "   —   " + info, 18))

func _process(_delta: float) -> void:
	if is_instance_valid(countdown) and not room.is_empty():
		var remaining: int = maxi(0, int(ceil((float(room.deadline) - Time.get_unix_time_from_system() * 1000.0 - clock_offset) / 1000.0)))
		countdown.text = ("Time to pick: %ds" if room.phase == "picking" else "Next up in %ds") % remaining

func load_session() -> void:
	var config := ConfigFile.new()
	config.load("user://session.cfg")
	player_id = str(config.get_value("player", "id", ""))
	nickname = str(config.get_value("player", "name", ""))
	room_code = str(config.get_value("player", "room", ""))
	if player_id.is_empty():
		var hex: String = Crypto.new().generate_random_bytes(16).hex_encode()
		player_id = "%s-%s-%s-%s-%s" % [hex.substr(0, 8), hex.substr(8, 4), hex.substr(12, 4), hex.substr(16, 4), hex.substr(20, 12)]
		save_session()

func save_session() -> void:
	var config := ConfigFile.new()
	config.set_value("player", "id", player_id)
	config.set_value("player", "name", nickname)
	config.set_value("player", "room", room_code)
	config.save("user://session.cfg")
