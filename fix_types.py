with open("src/services/rappels.ts", "r", encoding="utf-8") as f:
    content = f.read()

old_code = """    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),"""

new_code = """    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),"""

content = content.replace(old_code, new_code)

with open("src/services/rappels.ts", "w", encoding="utf-8") as f:
    f.write(content)
