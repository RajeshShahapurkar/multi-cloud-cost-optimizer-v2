from app.ml.provider_advisor import train_model

if __name__ == "__main__":
    result = train_model()
    print("Provider Advisor model trained.")
    print(result["metrics"])
