from fastapi import FastAPI

app = FastAPI()

@app.get('/ping')
async def ping():
    return {'ok': True}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8020, log_level='debug')
