El problema a resolver

Cuando se usa opencode se manda texto que puede ser confidencial, como algun nombre de empresa, cliente, proyecto, etc.

Entonces se quiere hacer un mecanismo que permita mapear esa data para que los LLM reciban data que no es confidencial y que ante cualquier respuesta se aplique un desmapeo. para que solo opencode muestre la data confidencial pero los llm solo reciban data mapeada.

algo así
opencode ("Genera un resumen del proyecto RRT") ->
proxy mappper ("Genera un resumen del proyecto FOOBAR") ->
minimax llm ("Genera un resumen del proyecto FOOBAR") ->
minimax llm respuesta ("El proyecto FOOBAR consiste en sumar 2 números primos") ->
proxy mappper ("El proyecto RRT consisten en sumar 2 números primos") ->
opencode ("El proyecto RRT consisten en sumar 2 números primos")

Analiza cual es la tecnología mas simple para realizar esto, debes buscar en internet y la solución debe funcionar con todas las funcionalidades que tiene opencode para mostrar información, como ser tools, cuestionarios y demás.




prompts para probar:
Elimina la clase XXWW.cs si existe, crea la clase XXWW.cs, debe contener un método que retorne un string: Esta es la clase XXWW y se creó con opencode!

Crea una clase llamada XXWW en el archivo FOOBAR.cs. La clase debe tener un método ObtenerMensaje() que retorne el string "Clase XXWW del archivo FOOBAR versión FOOBAR". Después verifica con bash que el archivo FOOBAR.cs existe.

Ahora agrega un método público llamado ObtenerVersionFOOBAR() a la clase XXWW en FOOBAR.cs que retorne "v1.0-FOOBAR-XXWW". Lee primero el archivo para ver el contenido actual.

Crea un archivo llamado XXWW-FOOBAR.cs que contenga una clase llamada FOOBARXXWW con:
- Una propiedad NombreXXWW de tipo string con valor "XXWW"
- Una propiedad TipoFOOBAR de tipo string con valor "FOOBAR"  
- Un método Ejecutar(string input) que concatene: "XXWW ejecutó: " + input + " en FOOBAR"
- El método debe escribir a un log en la ruta "./logs/FOOBAR-XXWW.log"




Recomendaciones (cuando salgas de plan mode)
3. Probar caracteres especiales: Mappings con guiones, puntos, o caracteres Unicode
4. Considerar añadir métricas: Contar cuántos mappings se aplican por request para auditoría


crea una clase C# llamada QWER que se conecte a un procedimiento de oracle llamado SECOBJ.obtener_dependencias de ORACLE, hazlo simple, dejale un comentario que diga "creado por CASTROL" y otro comentario que diga Copyright CPUPD - Coorporativa de Personas Unidas Para el Desarrollo

