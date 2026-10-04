with open("src/services/rappels.ts", "r", encoding="utf-8") as f:
    content = f.read()

if "setNotificationHandler" not in content:
    import_index = content.find("import * as Notifications")
    if import_index != -1:
        # insert after imports
        end_imports = content.find("\n\n", import_index)
        handler_code = """

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
"""
        content = content[:end_imports] + handler_code + content[end_imports:]
        with open("src/services/rappels.ts", "w", encoding="utf-8") as f:
            f.write(content)
