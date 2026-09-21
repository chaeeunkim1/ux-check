/** Convert the local contract to Anthropic's supported strict-tool schema subset.
 * Bounds remain enforced by local validators; descriptions preserve those limits.
 * https://platform.claude.com/docs/en/build-with-claude/structured-outputs#json-schema-limitations
 */
export function strictToolSchema(value){
 if(Array.isArray(value))return value.map(strictToolSchema);
 if(!value||typeof value!=='object')return value;
 const result={};const limits=[];
 for(const [key,item] of Object.entries(value)){
  if(['maxItems','minimum','maximum','minLength','maxLength'].includes(key)){limits.push(`${key}: ${item}`);continue;}
  result[key]=strictToolSchema(item);
 }
 if(limits.length)result.description=[result.description,...limits].filter(Boolean).join('. ');
 return result;
}
