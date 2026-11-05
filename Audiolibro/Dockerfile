# GTX 1070 Ti (sm_61): le build cu128 non la supportano piu', le cu126 si'.
FROM athomasson2/ebook2audiobook:cu128
RUN pip install --no-cache-dir --force-reinstall torch==2.11.0+cu126 torchaudio==2.11.0+cu126 --index-url https://download.pytorch.org/whl/cu126 --extra-index-url https://pypi.org/simple
# Senza queste, all'avvio l'app reinstalla da sola torch cu128.
ENV DEVICE_TAG=cu126
ENV DOCKER_DEVICE_STR="{\"name\": \"cuda\", \"os\": \"manylinux_2_28\", \"arch\": \"x86_64\", \"pyvenv\": [3, 12], \"tag\": \"cu126\", \"note\": \"CUDA 12.6\"}"
# L'app legge prima questo file, poi l'ambiente.
RUN printf '%s' "$DOCKER_DEVICE_STR" > /app/.device_info.json
