update public.internal_channels set
  description = case slug
    when 'general' then 'Спільні робочі питання'
    when 'management' then 'Генеральний директор і керівники'
    when 'store' then 'Керівник відділу продажів, менеджери магазину, бухгалтер і керівництво'
    when 'services' then 'Команда продажів і виконання послуг'
    when 'marketing-sales' then 'Матеріали, КП, презентації та креативи'
    when 'hr-security' then 'Кадрові та безпекові питання'
    when 'legal-sales' then 'Договори та перевірка клієнтів'
    else description
  end;
