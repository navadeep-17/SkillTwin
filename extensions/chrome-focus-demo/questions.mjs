// Locally reviewed demonstration questions. They are not SkillTwin proficiency evidence.
export const QUESTIONS = Object.freeze([
  {id:'sql-1',topic:'SQL',prompt:'Which SQL clause filters groups after an aggregate operation?',choices:['WHERE','HAVING','ORDER BY','LIMIT'],correct:1,explanation:'HAVING filters aggregated groups; WHERE filters individual rows before grouping.'},
  {id:'py-1',topic:'Python',prompt:'Which Python collection keeps only unique elements?',choices:['list','tuple','set','dict values'],correct:2,explanation:'A set stores unique elements without duplicates.'},
  {id:'dsa-1',topic:'DSA',prompt:'What is the average lookup complexity of a hash table?',choices:['O(n)','O(log n)','O(n log n)','O(1)'],correct:3,explanation:'Hash tables support expected O(1) lookup under normal hashing assumptions.'},
  {id:'sql-2',topic:'SQL',prompt:'Which SQL JOIN keeps every row from the left table?',choices:['INNER JOIN','LEFT JOIN','CROSS JOIN','RIGHT JOIN'],correct:1,explanation:'LEFT JOIN keeps every left-side row, even when there is no match.'},
  {id:'py-2',topic:'Python',prompt:'What is the result of len([10, 20, 30])?',choices:['2','3','30','60'],correct:1,explanation:'len returns the count of elements in the list: three.'},
  {id:'dsa-2',topic:'DSA',prompt:'Which data structure follows FIFO ordering?',choices:['Stack','Queue','Heap','Binary tree'],correct:1,explanation:'A queue removes elements in first-in, first-out order.'},
  {id:'sql-3',topic:'SQL',prompt:'Which keyword removes duplicate rows from SELECT results?',choices:['DISTINCT','UNIQUE KEY','GROUP BY ALL','LIMIT'],correct:0,explanation:'SELECT DISTINCT removes duplicate result rows.'},
  {id:'py-3',topic:'Python',prompt:'Which expression creates an empty dictionary in Python?',choices:['[]','()','{}','set()'],correct:2,explanation:'{} is an empty dictionary; set() creates an empty set.'},
  {id:'dsa-3',topic:'DSA',prompt:'Which traversal visits a binary search tree in sorted order?',choices:['Preorder','Postorder','Level order','Inorder'],correct:3,explanation:'Inorder traversal of a binary search tree visits keys in ascending order.'}
]);
export function questionAt(unlocksToday, quizIndex) {
  const index = (unlocksToday * 3 + quizIndex) % QUESTIONS.length;
  const {id,topic,prompt,choices} = QUESTIONS[index];
  return {id,topic,prompt,choices,number:quizIndex+1,total:3};
}
export function grade(unlocksToday,quizIndex,choice) {
  const question = QUESTIONS[(unlocksToday * 3 + quizIndex)%QUESTIONS.length];
  if (!Number.isInteger(choice) || choice<0 || choice>=question.choices.length) throw new Error('INVALID_CHOICE');
  return {correct:choice===question.correct,correctIndex:question.correct,explanation:question.explanation};
}
