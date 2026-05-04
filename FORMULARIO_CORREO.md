# Configuración del formulario de contacto

El formulario ya no simula el envío. Ahora valida campos, intenta enviar la solicitud por un endpoint externo y, si el hosting no permite el envío automático, abre el cliente de correo con el mensaje armado.

## 1. Cambiar el correo receptor

Abre `main.js` y modifica este bloque:

```js
const CONTACT_CONFIG = {
  recipientEmail: 'contacto@edge.io',
  endpoint: 'https://formsubmit.co/ajax/contacto@edge.io',
  subject: 'Nueva evaluación técnica - Edge.io',
};
```

Reemplaza `contacto@edge.io` por el correo real que recibirá las solicitudes.

Ejemplo:

```js
const CONTACT_CONFIG = {
  recipientEmail: 'ventas@tudominio.com',
  endpoint: 'https://formsubmit.co/ajax/ventas@tudominio.com',
  subject: 'Nueva evaluación técnica - Edge.io',
};
```

## 2. Activación inicial con FormSubmit

La primera vez que alguien envíe el formulario, FormSubmit enviará un correo de activación al correo configurado. Debes aceptar esa activación para que los siguientes mensajes lleguen normalmente.

## 3. Alternativa con Formspree

También puedes reemplazar el endpoint por uno de Formspree:

```js
endpoint: 'https://formspree.io/f/xxxxxxx',
```

## 4. Alternativa con Netlify

El formulario tiene `data-netlify="true"`, por lo que Netlify puede capturar los envíos si publicas allí. En ese caso, puedes configurar las notificaciones desde el panel de Netlify Forms.

## 5. Fallback por correo

Si el endpoint falla o el hosting bloquea el envío, el script abre un `mailto:` con toda la información diligenciada para que el usuario pueda enviarla manualmente desde su cliente de correo.
