from google import genai

client = genai.Client()

# List and print all available models
for model in client.models.list():
    print(f"Name: {model.name}")
