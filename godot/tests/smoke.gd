extends SceneTree
## Run: Godot --headless --path godot --script res://tests/smoke.gd
## Requires the web backend running on http://127.0.0.1:8787.

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var scene := load("res://main.tscn") as PackedScene
	var game = scene.instantiate()
	game.backend = "http://127.0.0.1:8787"
	root.add_child(game)
	game.room_code = ""
	game.name_input.text = "Godot QA"
	game.send_action("create")
	for i in range(150):
		await create_timer(0.1).timeout
		if not game.busy:
			break
	if game.room.is_empty() or game.room.get("phase") != "lobby":
		printerr("FAIL: Godot create room: " + game.status_label.text)
		quit(1)
		return
	var code: String = game.room_code
	game.poll()
	for i in range(100):
		await create_timer(0.1).timeout
		if not game.polling:
			break
	if game.room_code != code or game.room.players.size() != 1:
		printerr("FAIL: Godot room polling")
		quit(1)
		return
	print("PASS: Godot main scene, UI, anonymous room creation, HTTP API, room rendering and polling")
	game.queue_free()
	await process_frame
	quit(0)
