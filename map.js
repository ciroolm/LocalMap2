// ══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════════════════════

const USUARIO_VALIDO  = "admin";
const PASSWORD_VALIDO = "1234";
let mapaInicializado  = false;

document.getElementById("btn-login").addEventListener("click", intentarLogin);
document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && document.getElementById("pantalla-login").style.display !== "none")
        intentarLogin();
});

function intentarLogin() {
    const usuario  = document.getElementById("login-usuario").value.trim();
    const password = document.getElementById("login-password").value;
    const error    = document.getElementById("login-error");

    if (usuario === USUARIO_VALIDO && password === PASSWORD_VALIDO) {
        error.classList.remove("visible");
        entrarAlMapa();
    } else {
        error.classList.remove("visible");
        void error.offsetWidth;
        error.classList.add("visible");
    }
}

function entrarAlMapa() {
    const login     = document.getElementById("pantalla-login");
    const mapaPanel = document.getElementById("pantalla-mapa");

    login.classList.add("saliendo");
    setTimeout(() => {
        login.style.display = "none";
        mapaPanel.classList.remove("oculto");
        if (!mapaInicializado) {
            iniciarMapa();
            mapaInicializado = true;
        }
    }, 600);
}

document.getElementById("btn-cerrar-sesion").addEventListener("click", () => {
    const login     = document.getElementById("pantalla-login");
    const mapaPanel = document.getElementById("pantalla-mapa");

    mapaPanel.classList.add("oculto");
    login.style.display = "flex";
    login.classList.remove("saliendo");
    document.getElementById("login-usuario").value = "";
    document.getElementById("login-password").value = "";
    document.getElementById("login-error").classList.remove("visible");
});


// ══════════════════════════════════════════════════════════════════════════════
// MAPA
// ══════════════════════════════════════════════════════════════════════════════

const categorias = {
    "Alimentación": { color: "#e67e22", emoji: "🛒" },
    "Bebidas":      { color: "#2980b9", emoji: "🍺" },
    "Hogar":        { color: "#8e44ad", emoji: "🏠" },
    "Ropa":         { color: "#e74c3c", emoji: "👕" }
};

// Tipos de comercio de Overpass que se muestran en el buscador
const TIPOS_BUSQUEDA = {
    "Supermercado":  { osm: 'node["shop"="supermarket"]',    emoji: "🛒", color: "#e67e22" },
    "Restaurante":   { osm: 'node["amenity"="restaurant"]',  emoji: "🍽️", color: "#e74c3c" },
    "Café / Bar":    { osm: 'node["amenity"="cafe"]',         emoji: "☕", color: "#795548" },
    "Farmacia":      { osm: 'node["amenity"="pharmacy"]',     emoji: "💊", color: "#27ae60" },
    "Banco / ATM":   { osm: 'node["amenity"="bank"]',         emoji: "🏦", color: "#2980b9" },
    "Ropa / Moda":   { osm: 'node["shop"="clothes"]',         emoji: "👕", color: "#9b59b6" },
    "Panadería":     { osm: 'node["shop"="bakery"]',          emoji: "🥐", color: "#f39c12" },
    "Ferretería":    { osm: 'node["shop"="hardware"]',        emoji: "🔧", color: "#7f8c8d" },
};

let contadorId   = 0;
let pins         = [];
let marcadores   = {};
let marcadoresBusqueda = [];
let mapa;
let markerUbicacion = null;

function iniciarMapa() {
    // Empezar en Rosario; si el usuario acepta ubicación se mueve
    mapa = L.map("mapa").setView([-32.9468, -60.6393], 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(mapa);

    pedirUbicacion();
    configurarFiltros();
    configurarAgregarPin();
    configurarBuscador();
}

// ── Geolocalización ───────────────────────────────────────────────────────────
function pedirUbicacion() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude: lat, longitude: lng } = pos.coords;
            mapa.setView([lat, lng], 15);

            // Marcador de "tu posición"
            const iconoYo = L.divIcon({
                html: `<div style="
                    width:18px; height:18px;
                    background:#1a73e8;
                    border:3px solid white;
                    border-radius:50%;
                    box-shadow:0 0 0 4px rgba(26,115,232,0.3);
                "></div>`,
                className: "", iconSize: [18, 18], iconAnchor: [9, 9]
            });

            if (markerUbicacion) mapa.removeLayer(markerUbicacion);
            markerUbicacion = L.marker([lat, lng], { icon: iconoYo })
                .addTo(mapa)
                .bindPopup("<b>📍 Tu ubicación</b>");

            // Pre-cargar el select de búsqueda con la posición real
            document.getElementById("busq-lat").value = lat;
            document.getElementById("busq-lng").value = lng;
        },
        () => {
            // Si rechaza, usa coords de Rosario por defecto
            document.getElementById("busq-lat").value = -32.9468;
            document.getElementById("busq-lng").value = -60.6393;
        }
    );
}

// ── Filtros ───────────────────────────────────────────────────────────────────
function configurarFiltros() {
    document.querySelectorAll(".filtro-check").forEach(checkbox => {
        checkbox.addEventListener("change", () => {
            const cat = checkbox.dataset.categoria;
            pins.filter(p => p.categoria === cat).forEach(p => {
                if (!marcadores[p.id]) return;
                checkbox.checked ? marcadores[p.id].addTo(mapa) : mapa.removeLayer(marcadores[p.id]);
            });
        });
    });
}

// ── Agregar pin manual ────────────────────────────────────────────────────────
function configurarAgregarPin() {
    document.getElementById("btn-agregar").addEventListener("click", () => {
        const nombre    = document.getElementById("input-nombre").value.trim();
        const categoria = document.getElementById("select-categoria").value;

        if (!nombre) { alert("Por favor ingresá un nombre para el lugar."); return; }

        document.getElementById("aviso-click").style.display = "block";
        mapa.getContainer().style.cursor = "crosshair";

        mapa.once("click", (e) => {
            agregarPin(nombre, categoria, e.latlng.lat, e.latlng.lng);
            document.getElementById("input-nombre").value = "";
            document.getElementById("aviso-click").style.display = "none";
            mapa.getContainer().style.cursor = "";
        });
    });
}

function crearIcono(categoria) {
    const { color, emoji } = categorias[categoria];
    const html = `
        <div style="background:${color};width:36px;height:36px;border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;">
            <span style="transform:rotate(45deg);font-size:16px;">${emoji}</span>
        </div>`;
    return L.divIcon({ html, className: "", iconSize: [36,36], iconAnchor: [18,36], popupAnchor: [0,-38] });
}

function agregarPin(nombre, categoria, lat, lng) {
    const id  = ++contadorId;
    pins.push({ id, nombre, categoria, lat, lng });

    const popupHTML = `
        <div style="min-width:140px">
            <b>${nombre}</b><br>
            <span style="color:gray;font-size:13px">${categoria}</span><br>
            <button onclick="borrarPin(${id})" style="margin-top:8px;padding:5px 10px;
                background:#e74c3c;color:white;border:none;border-radius:6px;
                cursor:pointer;font-size:13px;width:100%;">🗑 Eliminar pin</button>
        </div>`;

    const marcador = L.marker([lat, lng], { icon: crearIcono(categoria) })
        .addTo(mapa).bindPopup(popupHTML);
    marcadores[id] = marcador;

    const check = document.querySelector(`.filtro-check[data-categoria="${categoria}"]`);
    if (check && !check.checked) mapa.removeLayer(marcador);
}

function borrarPin(id) {
    if (marcadores[id]) { mapa.removeLayer(marcadores[id]); delete marcadores[id]; }
    pins = pins.filter(p => p.id !== id);
}

// ══════════════════════════════════════════════════════════════════════════════
// BUSCADOR DE COMERCIOS (Overpass API)
// ══════════════════════════════════════════════════════════════════════════════

function configurarBuscador() {
    document.getElementById("btn-buscar").addEventListener("click", buscarComercios);
    document.getElementById("btn-limpiar-busqueda").addEventListener("click", limpiarResultados);
}

async function buscarComercios() {
    const tipo   = document.getElementById("busq-tipo").value;
    const radio  = document.getElementById("busq-radio").value;
    const lat    = parseFloat(document.getElementById("busq-lat").value);
    const lng    = parseFloat(document.getElementById("busq-lng").value);
    const info   = TIPOS_BUSQUEDA[tipo];

    if (!lat || !lng) { alert("No se pudo obtener tu ubicación. Activá el GPS e intentá de nuevo."); return; }

    const btnBuscar = document.getElementById("btn-buscar");
    btnBuscar.textContent = "Buscando...";
    btnBuscar.disabled = true;

    limpiarResultados();

    // Construir query Overpass
    const query = `
        [out:json][timeout:15];
        (
            ${info.osm}(around:${radio},${lat},${lng});
            node["amenity"="bar"](around:${radio},${lat},${lng});
        );
        out body;`;

    // Para el tipo exacto sin bares mezclados
    const queryLimpia = `[out:json][timeout:15];(${info.osm}(around:${radio},${lat},${lng}););out body;`;

    try {
        const resp = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: "data=" + encodeURIComponent(queryLimpia)
        });
        const data = await resp.json();
        mostrarResultados(data.elements, info, lat, lng);
    } catch (e) {
        alert("Error al buscar. Verificá tu conexión e intentá de nuevo.");
    } finally {
        btnBuscar.textContent = "🔍 Buscar";
        btnBuscar.disabled = false;
    }
}

function mostrarResultados(elementos, info, latOrigen, lngOrigen) {
    const lista = document.getElementById("lista-resultados");
    const conteo = document.getElementById("conteo-resultados");

    if (!elementos.length) {
        lista.innerHTML = `<p style="color:#999;font-size:14px;text-align:center;padding:10px">
            No se encontraron resultados en esta zona.</p>`;
        conteo.textContent = "";
        return;
    }

    // Ordenar por distancia
    elementos.sort((a, b) => distancia(latOrigen, lngOrigen, a.lat, a.lon)
                            - distancia(latOrigen, lngOrigen, b.lat, b.lon));

    const mostrar = elementos.slice(0, 20);
    conteo.textContent = `${mostrar.length} resultado${mostrar.length !== 1 ? "s" : ""}`;
    lista.innerHTML = "";

    mostrar.forEach(el => {
        const nombre = el.tags?.name || "Sin nombre";
        const dist   = Math.round(distancia(latOrigen, lngOrigen, el.lat, el.lon));
        const dir    = el.tags?.["addr:street"]
            ? `${el.tags["addr:street"]} ${el.tags["addr:housenumber"] || ""}`.trim()
            : "";

        // Marcador en el mapa
        const iconoHTML = `
            <div style="background:${info.color};width:30px;height:30px;border-radius:50% 50% 50% 0;
                transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);
                display:flex;align-items:center;justify-content:center;">
                <span style="transform:rotate(45deg);font-size:13px;">${info.emoji}</span>
            </div>`;
        const icono = L.divIcon({ html: iconoHTML, className: "", iconSize:[30,30], iconAnchor:[15,30], popupAnchor:[0,-32] });

        const marker = L.marker([el.lat, el.lon], { icon: icono })
            .addTo(mapa)
            .bindPopup(`<b>${nombre}</b>${dir ? `<br><span style="color:gray;font-size:12px">${dir}</span>` : ""}<br><span style="color:#2d8a2d;font-size:12px">📏 ${dist}m</span>`);

        marcadoresBusqueda.push(marker);

        // Item en la lista
        const item = document.createElement("div");
        item.className = "resultado-item";
        item.innerHTML = `
            <span class="resultado-emoji">${info.emoji}</span>
            <div class="resultado-info">
                <b>${nombre}</b>
                ${dir ? `<span>${dir}</span>` : ""}
            </div>
            <span class="resultado-dist">${dist < 1000 ? dist + "m" : (dist/1000).toFixed(1) + "km"}</span>`;

        item.addEventListener("click", () => {
            mapa.setView([el.lat, el.lon], 17);
            marker.openPopup();
        });

        lista.appendChild(item);
    });
}

function limpiarResultados() {
    marcadoresBusqueda.forEach(m => mapa.removeLayer(m));
    marcadoresBusqueda = [];
    document.getElementById("lista-resultados").innerHTML = "";
    document.getElementById("conteo-resultados").textContent = "";
}

// Fórmula de Haversine (distancia en metros)
function distancia(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
