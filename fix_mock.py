with open("src/services/rappels.ts", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("Notifications.setNotificationHandler({", "if (Notifications.setNotificationHandler) {\n  Notifications.setNotificationHandler({")
content = content.replace("  }),\n});", "  }),\n});\n}")

with open("src/services/rappels.ts", "w", encoding="utf-8") as f:
    f.write(content)
