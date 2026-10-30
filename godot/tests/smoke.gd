extends SceneTree
## Run: Godot --headless --path godot --script res://tests/smoke.gd
## Requires the web backend running on http://127.0.0.1:8787.

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var scene := load("res://main.tscn") as PackedScene
	var game = scene.instantiate()
	var test_url: String = OS.get_environment("GAME_URL")
	game.backend = test_url if not test_url.is_empty() else "http://127.0.0.1:8787"
	root.add_child(game)
	game.room_code = ""
	game.name_input.text = "Godot QA"
	var solo: bool = OS.get_environment("SOLO_TEST") == "1"
	game.send_action("create_solo" if solo else "create")
	for i in range(150):
		await create_timer(0.1).timeout
		if not game.busy:
			break
	if game.room.is_empty() or game.room.get("phase") != ("picking" if solo else "lobby"):
		printerr("FAIL: Godot create room: " + game.status_label.text)
		quit(1)
		return
	var code: String = game.room_code
	game.poll()
	for i in range(100):
		await create_timer(0.1).timeout
		if not game.polling:
			break
	if game.room_code != code or game.room.players.size() != (5 if solo else 1):
		printerr("FAIL: Godot room polling")
		quit(1)
		return
	if solo:
		game.send_action("vote", {"choice": 0})
		for i in range(150):
			await create_timer(0.1).timeout
			if game.room.get("phase") == "reveal":
				break
		if game.room.get("phase") != "reveal" or int(game.room.get("voted", 0)) != 5:
			printerr("FAIL: Godot solo bot votes and reveal: " + game.status_label.text)
			quit(1)
			return
	print("PASS: Godot main scene, UI, room creation, rendering, polling" + (", solo pick, four bots and reveal" if solo else ""))
	game.queue_free()
	await process_frame
	quit(0)
