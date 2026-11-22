/* Отзывы о преподавателях.
   Формат намеренно простой: сюда переносится то, что присылают студенты, без
   домыслов и без «средних оценок из головы». Если по преподавателю отзывов нет,
   раздел прямо об этом предупреждает, а не показывает пустую карточку.

   window.MedzoTeacherReviews = {
     updated: '2026-11-16',
     sources: [{ label: 'VK · club61162587', url: 'https://vk.com/club61162587' }],
     teachers: [{
       id: 'kafedra-anatomii-ivanov',
       name: 'Иванов Иван Иванович',
       subject: 'Анатомия человека',
       department: 'Кафедра анатомии',
       reviews: [{
         id: 'r1',
         year: 2026,
         rating: 4,            // 1–5 или null, если оценку не ставили
         text: 'Дословный текст отзыва.',
         source: 'VK · club61162587',
         url: 'https://vk.com/wall-61162587_123'
       }]
     }]
   }; */
window.MedzoTeacherReviews = {
  updated: '2026-11-16',
  sources: [
    { label: 'VK · Отзывы о преподавателях', url: 'https://vk.com/club61162587' }
  ],
  teachers: []
};
