# Diagnóstico de la clínica de código

## Contexto

El módulo calcula el presupuesto de una reparación con horas de mano de obra,
tarifa por hora, repuestos, descuento e impuesto. `enfermo.js` conserva una
implementación deliberadamente defectuosa para analizarla; `sano.js` contiene
la versión corregida. Ambos exportan `calculateEstimate`.

## Hallazgos en `enfermo.js`

| Severidad | Hallazgo                                                                              | Efecto                                                                               |
| --------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Alta      | No comprueba que la entrada sea un objeto ni que sus campos sean números finitos.     | Una entrada incompleta o mal formada puede producir `NaN` o un total engañoso.       |
| Alta      | No limita costos u horas negativos ni descuentos e impuestos al intervalo de 0 a 100. | Se pueden aceptar presupuestos imposibles o incluso importes negativos.              |
| Alta      | Suma `partsCost` sin normalizar ni validar el tipo.                                   | Si llega como texto, JavaScript concatena cadenas antes de los cálculos posteriores. |
| Media     | Devuelve el número con precisión binaria sin redondearlo a centavos.                  | El importe puede mostrar fracciones de centavo.                                      |
| Media     | No expresa ni separa las etapas del cálculo.                                          | Es más difícil revisar el orden de aplicación del descuento y del impuesto.          |

## Correcciones en `sano.js`

- Valida el objeto de entrada, todos los campos numéricos y su finitud.
- Rechaza valores negativos y porcentajes superiores al 100 con errores explícitos.
- Calcula mano de obra y subtotal en pasos separados; aplica descuento antes del impuesto.
- Redondea el total a dos decimales.
- No modifica la entrada recibida.

## Cobertura

`tests/presupuesto.test.js` comprueba el cálculo normal, los límites, el
redondeo y entradas inválidas. También reproduce tres fallos de la versión
enferma y comprueba que la versión corregida los rechaza.

## Ejemplo

Para 3 horas a 500, repuestos por 2,000, descuento de 10 % e impuesto de 15 %:

```text
(3 × 500 + 2,000) × (1 − 0.10) × (1 + 0.15) = 3,622.50
```
